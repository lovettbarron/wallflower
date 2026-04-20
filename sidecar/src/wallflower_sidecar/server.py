"""gRPC server implementing AnalysisService with streaming progress (D-09)."""
import grpc
from concurrent import futures
import logging

from wallflower_sidecar import wallflower_analysis_pb2 as pb2
from wallflower_sidecar import wallflower_analysis_pb2_grpc as pb2_grpc
from wallflower_sidecar.analyzers.tempo import TempoAnalyzer
from wallflower_sidecar.analyzers.key import KeyAnalyzer
from wallflower_sidecar.analyzers.sections import SectionAnalyzer
from wallflower_sidecar.analyzers.loops import LoopAnalyzer
from wallflower_sidecar.analyzers.separation import SeparationAnalyzer, SeparationProgress
from wallflower_sidecar.analyzers.base import AnalyzerConfig
from wallflower_sidecar.hardware import detect_hardware, recommend_profile

logger = logging.getLogger(__name__)


class AnalysisServer(pb2_grpc.AnalysisServiceServicer):
    """Implements the AnalysisService gRPC service.
    AnalyzeJam is a server-streaming RPC that yields progress for each step."""

    def __init__(self):
        # Default configs -- per AI-08, these can be swapped via config
        self.tempo_analyzer = TempoAnalyzer(
            AnalyzerConfig(name="essentia_rhythm", version="2.1")
        )
        self.key_analyzer = KeyAnalyzer(
            AnalyzerConfig(name="essentia_key", version="2.1")
        )
        self.section_analyzer = SectionAnalyzer(
            AnalyzerConfig(name="librosa_sections", version="0.10")
        )
        self.loop_analyzer = LoopAnalyzer(
            AnalyzerConfig(name="custom_loops", version="0.1")
        )

    def AnalyzeJam(self, request, context):
        """Server streaming RPC: yields AnalysisProgress for each step (D-09)."""
        jam_id = request.jam_id
        audio_path = request.audio_path
        skip_steps = set(request.skip_steps)
        is_lightweight = request.profile == pb2.LIGHTWEIGHT

        # Step 1: Tempo
        if "TEMPO" not in skip_steps:
            yield pb2.AnalysisProgress(
                jam_id=jam_id, step=pb2.TEMPO, status=pb2.STARTED
            )
            try:
                result = self.tempo_analyzer.analyze(audio_path)
                yield pb2.AnalysisProgress(
                    jam_id=jam_id,
                    step=pb2.TEMPO,
                    status=pb2.COMPLETED,
                    tempo=pb2.TempoResult(
                        bpm=result["bpm"],
                        confidence=result["confidence"],
                        beats=[
                            pb2.BeatPosition(time_seconds=b)
                            for b in result["beats"]
                        ],
                    ),
                )
            except Exception as e:
                logger.error(f"Tempo analysis failed for {jam_id}: {e}")
                yield pb2.AnalysisProgress(
                    jam_id=jam_id, step=pb2.TEMPO, status=pb2.FAILED
                )
        else:
            yield pb2.AnalysisProgress(
                jam_id=jam_id, step=pb2.TEMPO, status=pb2.SKIPPED
            )

        # Step 2: Key
        if "KEY" not in skip_steps:
            yield pb2.AnalysisProgress(
                jam_id=jam_id, step=pb2.KEY, status=pb2.STARTED
            )
            try:
                result = self.key_analyzer.analyze(audio_path)
                yield pb2.AnalysisProgress(
                    jam_id=jam_id,
                    step=pb2.KEY,
                    status=pb2.COMPLETED,
                    key=pb2.KeyResult(
                        key=result["key"],
                        scale=result["scale"],
                        strength=result["strength"],
                    ),
                )
            except Exception as e:
                logger.error(f"Key analysis failed for {jam_id}: {e}")
                yield pb2.AnalysisProgress(
                    jam_id=jam_id, step=pb2.KEY, status=pb2.FAILED
                )
        else:
            yield pb2.AnalysisProgress(
                jam_id=jam_id, step=pb2.KEY, status=pb2.SKIPPED
            )

        # Step 3: Sections (skip for LIGHTWEIGHT profile)
        sections_result = None
        if "SECTIONS" not in skip_steps and not is_lightweight:
            yield pb2.AnalysisProgress(
                jam_id=jam_id, step=pb2.SECTIONS, status=pb2.STARTED
            )
            try:
                sections_data = self.section_analyzer.analyze(audio_path)
                sections_result = sections_data
                yield pb2.AnalysisProgress(
                    jam_id=jam_id,
                    step=pb2.SECTIONS,
                    status=pb2.COMPLETED,
                    sections=pb2.SectionsResult(
                        sections=[
                            pb2.Section(
                                start_seconds=s["start_seconds"],
                                end_seconds=s["end_seconds"],
                                label=s["label"],
                                cluster_id=s["cluster_id"],
                            )
                            for s in sections_data
                        ]
                    ),
                )
            except Exception as e:
                logger.error(f"Section analysis failed for {jam_id}: {e}")
                yield pb2.AnalysisProgress(
                    jam_id=jam_id, step=pb2.SECTIONS, status=pb2.FAILED
                )
        else:
            yield pb2.AnalysisProgress(
                jam_id=jam_id, step=pb2.SECTIONS, status=pb2.SKIPPED
            )

        # Step 4: Loops (skip for LIGHTWEIGHT profile)
        if "LOOPS" not in skip_steps and not is_lightweight:
            yield pb2.AnalysisProgress(
                jam_id=jam_id, step=pb2.LOOPS, status=pb2.STARTED
            )
            try:
                loops_data = self.loop_analyzer.analyze(audio_path)
                yield pb2.AnalysisProgress(
                    jam_id=jam_id,
                    step=pb2.LOOPS,
                    status=pb2.COMPLETED,
                    loops=pb2.LoopsResult(
                        loops=[
                            pb2.Loop(
                                start_seconds=l["start_seconds"],
                                end_seconds=l["end_seconds"],
                                repeat_count=l["repeat_count"],
                                evolving=l["evolving"],
                                label=l["label"],
                            )
                            for l in loops_data
                        ]
                    ),
                )
            except Exception as e:
                logger.error(f"Loop analysis failed for {jam_id}: {e}")
                yield pb2.AnalysisProgress(
                    jam_id=jam_id, step=pb2.LOOPS, status=pb2.FAILED
                )
        else:
            yield pb2.AnalysisProgress(
                jam_id=jam_id, step=pb2.LOOPS, status=pb2.SKIPPED
            )

    def SeparateStems(self, request, context):
        """Server streaming RPC: yields SeparationProgress for chunked source separation."""
        bookmark_id = request.bookmark_id
        logger.info(f"Starting separation for bookmark {bookmark_id}: {request.audio_path}")

        separator = SeparationAnalyzer(
            AnalyzerConfig(name="demucs-mlx", version="0.1")
        )

        # Progress callback that yields gRPC messages
        progress_messages = []

        def on_progress(prog: SeparationProgress):
            progress_messages.append(prog)

        try:
            # Yield initial status
            yield pb2.SeparationProgress(
                bookmark_id=bookmark_id,
                status=pb2.SEPARATING,
                current_chunk=0,
                total_chunks=0,
                percent_complete=0.0,
            )

            # Run separation (blocks until complete or cancelled)
            import threading

            result_holder = {"stems": {}, "error": None}

            def run_separation():
                try:
                    stems = separator.separate(
                        audio_path=request.audio_path,
                        start_seconds=request.start_seconds,
                        end_seconds=request.end_seconds,
                        output_dir=request.output_dir,
                        model_name=request.model_name or "htdemucs",
                        segment_seconds=request.segment_seconds or 10.0,
                        overlap=request.overlap or 0.25,
                        on_progress=on_progress,
                    )
                    result_holder["stems"] = stems
                except Exception as e:
                    result_holder["error"] = str(e)

            sep_thread = threading.Thread(target=run_separation)
            sep_thread.start()

            # Stream progress while separation runs
            reported = 0
            while sep_thread.is_alive():
                # Check if client disconnected
                if not context.is_active():
                    separator.cancel()
                    sep_thread.join(timeout=5.0)
                    yield pb2.SeparationProgress(
                        bookmark_id=bookmark_id,
                        status=pb2.CANCELLED,
                    )
                    return

                # Yield any new progress messages
                while reported < len(progress_messages):
                    prog = progress_messages[reported]
                    yield pb2.SeparationProgress(
                        bookmark_id=bookmark_id,
                        status=pb2.CHUNK_COMPLETE,
                        current_chunk=prog.current_chunk,
                        total_chunks=prog.total_chunks,
                        percent_complete=prog.percent_complete,
                        estimated_seconds_remaining=prog.estimated_seconds_remaining,
                    )
                    reported += 1

                sep_thread.join(timeout=0.1)

            # Flush remaining progress
            while reported < len(progress_messages):
                prog = progress_messages[reported]
                yield pb2.SeparationProgress(
                    bookmark_id=bookmark_id,
                    status=pb2.CHUNK_COMPLETE,
                    current_chunk=prog.current_chunk,
                    total_chunks=prog.total_chunks,
                    percent_complete=prog.percent_complete,
                    estimated_seconds_remaining=prog.estimated_seconds_remaining,
                )
                reported += 1

            # Check for errors
            if result_holder["error"]:
                logger.error(f"Separation failed for {bookmark_id}: {result_holder['error']}")
                yield pb2.SeparationProgress(
                    bookmark_id=bookmark_id,
                    status=pb2.SEPARATION_FAILED,
                    error_message=result_holder["error"],
                )
                return

            # Check for cancellation
            stems = result_holder["stems"]
            if not stems:
                yield pb2.SeparationProgress(
                    bookmark_id=bookmark_id,
                    status=pb2.CANCELLED,
                )
                return

            # Build stem file list
            import os
            stem_files = []
            for stem_name, file_path in stems.items():
                try:
                    size = os.path.getsize(file_path)
                except OSError:
                    size = 0
                stem_files.append(pb2.StemFile(
                    stem_name=stem_name,
                    file_path=file_path,
                    file_size_bytes=size,
                ))

            # Yield completion
            yield pb2.SeparationProgress(
                bookmark_id=bookmark_id,
                status=pb2.SEPARATION_COMPLETED,
                current_chunk=len(progress_messages),
                total_chunks=len(progress_messages),
                percent_complete=100.0,
                estimated_seconds_remaining=0.0,
                stem_files=stem_files,
            )
            logger.info(f"Separation complete for {bookmark_id}: {len(stems)} stems")

        except Exception as e:
            logger.error(f"Separation error for {bookmark_id}: {e}")
            yield pb2.SeparationProgress(
                bookmark_id=bookmark_id,
                status=pb2.SEPARATION_FAILED,
                error_message=str(e),
            )

    def GetHealth(self, request, context):
        return pb2.HealthResponse(healthy=True, version="0.1.0")

    def GetHardwareInfo(self, request, context):
        hw = detect_hardware()
        profile_name = recommend_profile(hw)
        profile_map = {
            "FULL": pb2.FULL,
            "STANDARD": pb2.STANDARD,
            "LIGHTWEIGHT": pb2.LIGHTWEIGHT,
        }
        return pb2.HardwareInfoResponse(
            chip=hw["chip"],
            cores=hw["cores"],
            memory_bytes=hw["memory_bytes"],
            recommended_profile=profile_map.get(profile_name, pb2.STANDARD),
        )


def serve(port: int = 50051):
    """Start the gRPC server on the given port."""
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    pb2_grpc.add_AnalysisServiceServicer_to_server(AnalysisServer(), server)

    # Add gRPC health service for liveness probing
    from grpc_health.v1 import health, health_pb2, health_pb2_grpc

    health_servicer = health.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    health_servicer.set(
        "wallflower.analysis.AnalysisService",
        health_pb2.HealthCheckResponse.SERVING,
    )

    server.add_insecure_port(f"127.0.0.1:{port}")
    logger.info(f"Analysis sidecar starting on port {port}")
    server.start()
    server.wait_for_termination()
