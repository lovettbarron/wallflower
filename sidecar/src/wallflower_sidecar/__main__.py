import argparse
import logging


def main():
    parser = argparse.ArgumentParser(description="Wallflower ML Analysis Sidecar")
    parser.add_argument("--port", type=int, default=50051, help="gRPC server port")
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    from wallflower_sidecar.server import serve

    serve(port=args.port)


if __name__ == "__main__":
    main()
