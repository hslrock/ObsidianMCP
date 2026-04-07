# Cursor에서 Obsidian MCP 서버 사용하기

이 가이드는 **uv**로 관리하는 Obsidian MCP 서버를 Cursor IDE에 연결하는 방법을 설명합니다.

## 사전 요구 사항

- [uv](https://docs.astral.sh/uv/) 설치
- 프로젝트에서 `uv sync`로 의존성 설치 완료
- Obsidian vault 경로를 `.env`의 `OBSIDIAN_VAULT_PATH` 또는 환경 변수로 설정

## 설정 방법

### 방법 1: 프로젝트별 설정 (권장)

프로젝트를 Cursor로 연 상태에서 `.cursor/mcp.json`을 사용합니다.  
(파일이 없으면 프로젝트 루트에 `.cursor` 폴더를 만들고 `mcp.json`을 생성하세요.)

**파일 위치**: `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "Obsidian MCP Server": {
      "command": "/Users/lapolaebseu/Documents/ObsidianMCP/.venv/bin/python",
      "args": [
        "/Users/lapolaebseu/Documents/ObsidianMCP/main.py"
      ],
      "env": {}
    }
  }
}
```

**uv 사용 시**: `command`는 반드시 **프로젝트 내 `.venv`의 `python`** 경로를 사용하세요.  
다른 경로에 프로젝트를 둔 경우 위 경로를 본인 환경에 맞게 수정하세요.

### 방법 2: 전역 설정

Cursor에서 모든 프로젝트에 동일한 MCP 서버를 쓰려면 전역 설정에 추가합니다.

**파일 위치**: `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "Obsidian MCP Server": {
      "command": "/Users/lapolaebseu/Documents/ObsidianMCP/.venv/bin/python",
      "args": [
        "/Users/lapolaebseu/Documents/ObsidianMCP/main.py"
      ],
      "env": {}
    }
  }
}
```

### 방법 3: Cursor 설정 UI

1. Cursor 설정 열기: `Cmd + ,` (macOS) 또는 `Ctrl + ,` (Windows)
2. **Tools & MCP** 이동
3. **"Add new MCP server"** 클릭
4. 입력:
   - **Name**: `Obsidian MCP Server`
   - **Type**: `command`
   - **Command**: `/Users/lapolaebseu/Documents/ObsidianMCP/.venv/bin/python` (본인 프로젝트의 `.venv/bin/python` 경로)
   - **Args**: `/Users/lapolaebseu/Documents/ObsidianMCP/main.py`
   - **Environment Variables**: 필요 시 `OBSIDIAN_VAULT_PATH` 등 추가

## 셋업 단계 (uv)

1. **의존성 설치**  
   프로젝트 루트에서:
   ```bash
   uv sync
   ```

2. **가상환경 경로 확인**  
   `mcp.json`의 `command`가 다음 중 하나를 가리키는지 확인합니다.
   - `프로젝트경로/.venv/bin/python` (Unix/macOS)
   - `프로젝트경로\.venv\Scripts\python.exe` (Windows)

3. **Cursor 완전 재시작**  
   MCP 설정을 바꾼 뒤에는 Cursor를 **완전히 종료했다가 다시 실행**해야 합니다. 창만 닫지 말고 앱 종료 후 재실행하세요.

## MCP 서버 동작 확인

### 1. 서버 로드 여부

재시작 후:

1. Command Palette: `Cmd + Shift + P` (macOS) / `Ctrl + Shift + P` (Windows)
2. "MCP" 검색
3. `Obsidian MCP Server` 또는 추가한 이름이 보이는지 확인

### 2. 도구로 테스트

채팅에서 예시:

- **서버 정보**:  
  `get_server_info로 Obsidian MCP 서버 정보 알려줘`

- **노트 목록**:  
  `Obsidian MCP로 vault 노트 목록 조회해줘`

- **노트 읽기**:  
  `read_obsidian_note로 "노트이름" 내용 읽어줘`

- **태그 검색**:  
  `search_by_tag로 "태그이름" 노트 찾아줘`

- **일일 노트**:  
  `get_daily_note로 오늘 일일 노트 가져와줘`

## 문제 해결

### 서버가 안 뜨는 경우

1. **Python 경로**  
   - 터미널에서: `프로젝트경로/.venv/bin/python -c "import sys; print(sys.executable)"`  
   - 출력된 경로를 `mcp.json`의 `command`에 그대로 사용하세요.

2. **의존성**  
   ```bash
   cd /Users/lapolaebseu/Documents/ObsidianMCP
   uv sync
   uv run python main.py
   ```  
   에러 없이 실행되는지 확인합니다. `Ctrl+C`로 종료.

3. **vault 경로**  
   - `.env`에 `OBSIDIAN_VAULT_PATH=절대경로` 가 설정되어 있는지 확인합니다.  
   - 또는 MCP 서버의 `env`에 `OBSIDIAN_VAULT_PATH`를 넣을 수 있습니다.

4. **실행 권한**  
   ```bash
   chmod +x main.py
   ```

5. **Cursor 로그**  
   설정 또는 개발자 도구에서 MCP 관련 에러 메시지가 있는지 확인합니다.

### uv 가상환경 사용 (권장)

이 프로젝트는 **uv** 기준이므로, Cursor MCP에서는 반드시 **프로젝트의 `.venv`** 안의 Python을 사용해야 합니다.

```json
{
  "mcpServers": {
    "Obsidian MCP Server": {
      "command": "/Users/lapolaebseu/Documents/ObsidianMCP/.venv/bin/python",
      "args": [
        "/Users/lapolaebseu/Documents/ObsidianMCP/main.py"
      ],
      "env": {}
    }
  }
}
```

vault 경로를 여기서만 지정하고 싶다면:

```json
"env": {
  "OBSIDIAN_VAULT_PATH": "/path/to/your/vault"
}
```

### 상대 경로/스크립트로 실행 (선택)

프로젝트 루트에서 실행하는 스크립트를 쓸 수 있습니다. `start_mcp.sh`:

```bash
#!/bin/bash
cd "$(dirname "$0")"
.venv/bin/python main.py
```

그다음 `mcp.json`:

```json
{
  "mcpServers": {
    "Obsidian MCP Server": {
      "command": "/Users/lapolaebseu/Documents/ObsidianMCP/start_mcp.sh",
      "args": [],
      "env": {}
    }
  }
}
```

## 제공 도구 요약

- **노트**: 읽기, 생성, 수정, 목록, 검색  
- **태그**: 태그 조회/추가/제거, 태그별 검색  
- **링크**: 노트 링크, 백링크, 끊긴 링크, 고아 노트  
- **템플릿**: 목록, 생성, 저장, 조회  
- **일일 노트**: 생성, 조회, 목록  
- **통계/폴더**: vault 통계, 노트 통계, 폴더 목록/생성/이동/삭제  
- **고급 검색**: 정규식, 날짜 범위, 퍼지 검색  
- **블록/임베드**: 블록 조회·수정, 노트 임베드  

전체 목록은 채팅에서 `get_server_info`를 호출해 확인할 수 있습니다.

## 체크리스트

- [ ] `uv sync`로 의존성 설치
- [ ] `.env`에 `OBSIDIAN_VAULT_PATH` 설정 (또는 MCP `env`에 설정)
- [ ] `.cursor/mcp.json`에 `.venv/bin/python` 및 `main.py` 경로 설정
- [ ] Cursor 완전 재시작
- [ ] MCP 설정에 "Obsidian MCP Server" 표시 확인
- [ ] 채팅에서 `get_server_info` 또는 노트 조회로 동작 확인

자세한 내용은 [Cursor MCP 문서](https://cursor.com/docs/context/mcp)를 참고하세요.
