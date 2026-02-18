#!/usr/bin/env python3
"""
Script to run the FastAPI MCP server

Usage:
    python run_server.py              # Run MCP server
    python run_server.py --http       # Run HTTP server
    python run_server.py --port 8000  # Run HTTP server on custom port
"""

import argparse
import uvicorn
from main import app, mcp


def main():
    parser = argparse.ArgumentParser(description="Run the FastAPI MCP Server")
    parser.add_argument(
        "--http",
        action="store_true",
        help="Run as HTTP server instead of MCP server"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port for HTTP server (default: 8000)"
    )
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host for HTTP server (default: 127.0.0.1)"
    )
    
    args = parser.parse_args()
    
    if args.http:
        print(f"Starting HTTP server on http://{args.host}:{args.port}")
        print(f"API docs available at http://{args.host}:{args.port}/docs")
        uvicorn.run(app, host=args.host, port=args.port)
    else:
        print("Starting MCP server...")
        mcp.run()


if __name__ == "__main__":
    main()
