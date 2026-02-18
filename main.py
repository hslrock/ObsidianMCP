"""
FastAPI MCP Server Example

This server demonstrates how to create an MCP server using FastAPI and FastMCP.
It includes sample tools, resources, and prompts.
"""

from mcp.server import FastMCP
from pydantic import BaseModel
import json

# Create FastMCP instance
mcp = FastMCP("Sample FastAPI MCP Server")

class CalculatorRequest(BaseModel):
    """Request model for calculator operations"""
    operation: str
    a: float
    b: float


class EchoRequest(BaseModel):
    """Request model for echo tool"""
    message: str
    repeat: int = 1



@mcp.tool()
def calculator(operation: str, a: float, b: float) -> dict:
    """
    Perform basic arithmetic operations.
    
    Args:
        operation: The operation to perform (add, subtract, multiply, divide)
        a: First number
        b: Second number
    
    Returns:
        Dictionary with the result of the operation
    """
    operations = {
        "add": lambda x, y: x + y,
        "subtract": lambda x, y: x - y,
        "multiply": lambda x, y: x * y,
        "divide": lambda x, y: x / y if y != 0 else None
    }
    
    if operation not in operations:
        return {"error": f"Unknown operation: {operation}. Use: add, subtract, multiply, divide"}
    
    if operation == "divide" and b == 0:
        return {"error": "Cannot divide by zero"}
    
    result = operations[operation](a, b)
    return {
        "operation": operation,
        "a": a,
        "b": b,
        "result": result
    }


@mcp.tool()
def echo(message: str, repeat: int = 1) -> dict:
    """
    Echo a message multiple times.
    
    Args:
        message: The message to echo
        repeat: Number of times to repeat the message (default: 1)
    
    Returns:
        Dictionary with the echoed message
    """
    if repeat < 1:
        repeat = 1
    if repeat > 10:
        repeat = 10
    
    echoed = "\n".join([message] * repeat)
    return {
        "message": message,
        "repeat": repeat,
        "output": echoed
    }


@mcp.tool()
def get_server_info() -> dict:
    """
    Get information about the MCP server.
    
    Returns:
        Dictionary with server information
    """
    return {
        "name": "Sample FastAPI MCP Server",
        "version": "1.0.0",
        "tools": ["calculator", "echo", "get_server_info"],
        "resources": ["sample://data"],
        "status": "running"
    }


# ============================================================================
# MCP Resources
# ============================================================================

@mcp.resource("sample://data")
def get_sample_data() -> str:
    """
    Get sample data resource.
    
    Returns:
        JSON string with sample data
    """
    data = {
        "users": [
            {"id": 1, "name": "Alice", "role": "admin"},
            {"id": 2, "name": "Bob", "role": "user"},
            {"id": 3, "name": "Charlie", "role": "user"}
        ],
        "metadata": {
            "total_users": 3,
            "last_updated": "2026-02-18"
        }
    }
    return json.dumps(data, indent=2)


# ============================================================================
# MCP Prompts
# ============================================================================

@mcp.prompt()
def greeting_prompt(name: str = "User") -> str:
    """
    Generate a greeting prompt.
    
    Args:
        name: Name of the person to greet
    
    Returns:
        A greeting message
    """
    return f"Hello, {name}! Welcome to the Sample FastAPI MCP Server."


@mcp.prompt()
def help_prompt() -> str:
    """
    Generate a help prompt with available tools.
    
    Returns:
        Help message with tool descriptions
    """
    return """Available tools:
1. calculator - Perform arithmetic operations (add, subtract, multiply, divide)
2. echo - Echo a message multiple times
3. get_server_info - Get server information

Available resources:
1. sample://data - Get sample user data

Available prompts:
1. greeting_prompt - Generate a greeting
2. help_prompt - Show this help message"""


# ============================================================================
# FastAPI Routes (for HTTP access)
# ============================================================================


if __name__ == "__main__":
    import uvicorn
    # Run the FastMCP server
    mcp.run()
