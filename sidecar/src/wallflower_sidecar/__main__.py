import argparse


def main():
    parser = argparse.ArgumentParser(description="Wallflower ML Analysis Sidecar")
    parser.add_argument("--port", type=int, default=50051, help="gRPC server port")
    args = parser.parse_args()
    # Server module will be implemented in Plan 03
    print(f"Wallflower sidecar starting on port {args.port}...")


if __name__ == "__main__":
    main()
