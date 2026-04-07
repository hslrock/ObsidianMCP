# Claude Code에서 Obsidian MCP 서버 사용하기

이 가이드는 **uv**로 관리하는 Obsidian MCP 서버를 Claude Code CLI에 연결하는 방법을 설명합니다.

## 사전 요구 사항

- [uv](https://docs.astral.sh/uv/) 설치
- 프로젝트에서 `uv sync`로 의존성 설치 완료
- Obsidian vault 경로 확인

## 설정 방법

### 1. 의존성 설치

```bash
cd /path/to/ObsidianMCP
uv sync
```

### 2. Obsidian vault 경로 확인

```bash
# macOS 기준 - .obsidian 폴더가 있는 디렉토리가 vault 루트
find ~ -name ".obsidian" -type d 2>/dev/null
```

### 3. MCP 서버 등록

```bash
claude mcp add obsidian-mcp \
  -e OBSIDIAN_VAULT_PATH=/path/to/your/vault \
  -- \
  /path/to/ObsidianMCP/.venv/bin/python \
  /path/to/ObsidianMCP/main.py
```

**실제 경로 예시:**

```bash
claude mcp add obsidian-mcp \
  -e OBSIDIAN_VAULT_PATH=/Users/yourname/Documents/MyVault \
  -- \
  /Users/yourname/Projects/ObsidianMCP/.venv/bin/python \
  /Users/yourname/Projects/ObsidianMCP/main.py
```

### 4. 연결 확인

```bash
claude mcp list
```

`obsidian-mcp: ✓ Connected` 가 출력되면 설정 완료입니다.

## 설정 저장 위치

`claude mcp add` 명령어는 명령어를 실행한 디렉토리 기준으로 `~/.claude.json`에 로컬 설정으로 저장됩니다.

전역(모든 디렉토리)으로 사용하려면 `--scope user` 옵션을 추가합니다:

```bash
claude mcp add obsidian-mcp --scope user \
  -e OBSIDIAN_VAULT_PATH=/path/to/your/vault \
  -- \
  /path/to/ObsidianMCP/.venv/bin/python \
  /path/to/ObsidianMCP/main.py
```

## 동작 확인

Claude Code 채팅에서 아래와 같이 테스트합니다:

- **서버 정보**: `get_server_info 툴로 Obsidian MCP 서버 정보 알려줘`
- **노트 목록**: `vault 노트 목록 조회해줘`
- **노트 읽기**: `"노트이름" 내용 읽어줘`
- **태그 검색**: `"태그이름" 태그가 달린 노트 찾아줘`
- **일일 노트**: `오늘 일일 노트 가져와줘`

## 문제 해결

### 서버가 연결되지 않는 경우

1. **Python 경로 확인**

   ```bash
   /path/to/ObsidianMCP/.venv/bin/python -c "import sys; print(sys.executable)"
   ```

2. **서버 직접 실행해서 에러 확인**

   ```bash
   cd /path/to/ObsidianMCP
   uv run python main.py
   ```

3. **MCP 서버 제거 후 재등록**

   ```bash
   claude mcp remove obsidian-mcp
   claude mcp add obsidian-mcp ...
   ```

## 체크리스트

- [ ] `uv sync`로 의존성 설치
- [ ] Obsidian vault 경로 확인
- [ ] `claude mcp add` 명령어로 서버 등록 (경로 및 환경변수 포함)
- [ ] `claude mcp list`에서 `✓ Connected` 확인
- [ ] Claude Code 채팅에서 노트 조회 테스트
