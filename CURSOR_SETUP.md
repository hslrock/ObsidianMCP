# Testing MCP Server in Cursor IDE

This guide explains how to configure and test your FastAPI MCP server in Cursor IDE.

## Configuration Methods

### Method 1: Project-Level Configuration (Recommended)

The project already includes a `.cursor/mcp.json` file. This configuration will be available when you open this project in Cursor.

**File location**: `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "sample-fastapi-mcp": {
      "command": "python",
      "args": [
        "/Users/lapolaebseu/Documents/ObsidianMCP/main.py"
      ],
      "env": {}
    }
  }
}
```

**Note**: Update the path in `args` if your project is located elsewhere.

### Method 2: Global Configuration

For system-wide access, add the configuration to your global Cursor settings:

**File location**: `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "sample-fastapi-mcp": {
      "command": "python",
      "args": [
        "/Users/lapolaebseu/Documents/ObsidianMCP/main.py"
      ],
      "env": {}
    }
  }
}
```

### Method 3: Using Cursor Settings UI

1. Open Cursor Settings: `Cmd + ,` (macOS) or `Ctrl + ,` (Windows)
2. Navigate to **Tools & MCP** section
3. Click **"Add new MCP server"**
4. Fill in:
   - **Name**: `sample-fastapi-mcp`
   - **Type**: `command`
   - **Command**: `python`
   - **Args**: `/Users/lapolaebseu/Documents/ObsidianMCP/main.py`
   - **Environment Variables**: (leave empty or add any needed env vars)

## Setup Steps

1. **Install Dependencies** (if not already done):
   ```bash
   pip install -e .
   ```

2. **Verify Python Path**:
   Make sure the path in `mcp.json` points to your `main.py` file. You can use an absolute path or relative path.

3. **Restart Cursor**:
   ⚠️ **IMPORTANT**: You must completely quit and restart Cursor after adding/updating MCP server configuration. MCP servers only load at startup.

## Testing the MCP Server in Cursor

### Step 1: Verify Server is Loaded

After restarting Cursor:

1. Open the Command Palette: `Cmd + Shift + P` (macOS) or `Ctrl + Shift + P` (Windows)
2. Type "MCP" to see MCP-related commands
3. Look for your server name: `sample-fastapi-mcp`

### Step 2: Test MCP Tools

You can test the MCP tools directly in Cursor's chat:

**Example prompts to try:**

1. **Calculator Tool**:
   ```
   Use the calculator tool to add 15 and 27
   ```
   
   ```
   Calculate 100 divided by 4 using the calculator tool
   ```

2. **Echo Tool**:
   ```
   Use the echo tool to repeat "Hello Cursor!" 3 times
   ```

3. **Server Info Tool**:
   ```
   Get information about the MCP server using get_server_info
   ```

### Step 3: Test MCP Resources

Ask Cursor to access the sample data resource:

```
Get the sample_data resource from the MCP server
```

### Step 4: Test MCP Prompts

```
Use the greeting_prompt with name "Cursor User"
```

## Troubleshooting

### Server Not Loading

1. **Check Python Path**:
   - Verify Python is in your PATH: `which python` or `which python3`
   - Update `mcp.json` to use `python3` if needed

2. **Check File Permissions**:
   ```bash
   chmod +x main.py
   ```

3. **Test Server Manually**:
   ```bash
   python main.py
   ```
   The server should start without errors. Press Ctrl+C to stop.

4. **Check Cursor Logs**:
   - Open Cursor Settings
   - Look for MCP-related errors in the console/logs

### Using Virtual Environment

If you're using a virtual environment, update `mcp.json`:

```json
{
  "mcpServers": {
    "sample-fastapi-mcp": {
      "command": "/Users/lapolaebseu/Documents/ObsidianMCP/.venv/bin/python",
      "args": [
        "/Users/lapolaebseu/Documents/ObsidianMCP/main.py"
      ],
      "env": {}
    }
  }
}
```

### Alternative: Using Relative Paths

You can also use a wrapper script. Create `start_mcp.sh`:

```bash
#!/bin/bash
cd "$(dirname "$0")"
python main.py
```

Then update `mcp.json`:

```json
{
  "mcpServers": {
    "sample-fastapi-mcp": {
      "command": "/Users/lapolaebseu/Documents/ObsidianMCP/start_mcp.sh",
      "args": [],
      "env": {}
    }
  }
}
```

## Available Tools

Once configured, these tools will be available in Cursor:

- **calculator**: Perform arithmetic operations (add, subtract, multiply, divide)
- **echo**: Echo a message multiple times
- **get_server_info**: Get server information

## Available Resources

- **sample_data**: Sample user data in JSON format

## Available Prompts

- **greeting_prompt**: Generate a greeting message
- **help_prompt**: Show help information

## Verification Checklist

- [ ] Dependencies installed (`pip install -e .`)
- [ ] `.cursor/mcp.json` file exists with correct path
- [ ] Cursor has been completely restarted (not just reloaded)
- [ ] MCP server appears in Cursor's MCP settings
- [ ] Can see tools when typing "MCP" in command palette
- [ ] Can successfully call tools from Cursor chat

## Next Steps

Once your MCP server is working in Cursor, you can:

1. Add more tools to `main.py` using `@mcp.tool()`
2. Add more resources using `@mcp.resource()`
3. Add more prompts using `@mcp.prompt()`
4. Share the `.cursor/mcp.json` with your team (commit to git)

For more information, see the [Cursor MCP Documentation](https://cursor.com/docs/context/mcp).
