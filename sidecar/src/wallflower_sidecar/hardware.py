import subprocess


def detect_hardware() -> dict:
    """Detect Apple Silicon hardware capabilities."""
    chip = "unknown"
    cores = 0
    memory_bytes = 0
    try:
        result = subprocess.run(
            ["sysctl", "-n", "machdep.cpu.brand_string"],
            capture_output=True,
            text=True,
        )
        chip = result.stdout.strip()
    except Exception:
        pass
    try:
        result = subprocess.run(
            ["sysctl", "-n", "hw.ncpu"], capture_output=True, text=True
        )
        cores = int(result.stdout.strip())
    except Exception:
        pass
    try:
        result = subprocess.run(
            ["sysctl", "-n", "hw.memsize"], capture_output=True, text=True
        )
        memory_bytes = int(result.stdout.strip())
    except Exception:
        pass
    return {"chip": chip, "cores": cores, "memory_bytes": memory_bytes}


def recommend_profile(hw: dict) -> str:
    """Recommend an analysis profile based on hardware.
    Conservative: Lightweight on machines with <=8GB or <=4 perf cores.
    Full on M4 Pro/Max or machines with >=16GB and >=8 cores."""
    mem_gb = hw.get("memory_bytes", 0) / (1024**3)
    cores = hw.get("cores", 0)
    if mem_gb >= 16 and cores >= 8:
        return "FULL"
    elif mem_gb >= 8 and cores >= 4:
        return "STANDARD"
    else:
        return "LIGHTWEIGHT"
