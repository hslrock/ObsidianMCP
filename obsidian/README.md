# Obsidian MCP Tools

Obsidian vault와 상호작용하기 위한 MCP 도구 모듈입니다.

## 구조

도메인별로 모듈이 분리되어 있어 확장이 쉽습니다:

- `vault.py` - Vault 경로 관리 및 검증
- `notes.py` - 노트 생성, 읽기, 업데이트, 목록 조회, 검색

## 추후 확장 가능한 도메인

- `tags.py` - 태그 관리 (태그 추가/제거, 태그별 노트 조회)
- `links.py` - 링크 관리 (내부 링크, 외부 링크, 백링크)
- `attachments.py` - 첨부 파일 관리 (이미지, PDF 등)
- `templates.py` - 템플릿 관리
- `daily_notes.py` - 일일 노트 관리
- `graph.py` - 그래프 분석 및 시각화

## 사용법

각 도메인 모듈은 `register_*_tools(mcp)` 함수를 제공하여 MCP 서버에 도구를 등록합니다.

```python
from obsidian import register_note_tools

mcp = FastMCP("Obsidian MCP Server")
register_note_tools(mcp)
```
