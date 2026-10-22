"""Read public CLI binary metadata only; never execute or import the CLI/application."""
import hashlib
import json
import mmap
from pathlib import Path
import sys

EXPECTED_SHA512 = 'f57ad0a04c93e1d13b86bd13c4f35b6577bc0557e6bfd718e9f3a2bdb4504240113f6bbcfefad9f039eb1d5e7e23e0a2623b4b7687882eca86954e485ad9f9c2'
PUBLIC_EXCERPTS = {
 'Markdown_fields': 'Markdown agents support `mainAgent`, `subagent`, `hidden`, `inheritMcp`, and `commandExecutionPolicy` frontmatter fields',
 'MCP_dispatcher_fix': 'Fixed subagents defined with `enable_mcp_tools=true` failing with unknown tool errors by ensuring the MCP dispatcher meta-tool is available to the subagent executor.',
}

if __name__ == '__main__':
 binary=Path(sys.argv[1])
 assert binary.is_absolute() and binary.is_file() and not binary.is_symlink()
 assert binary.stat().st_size <= 256*1024*1024
 with binary.open('rb') as handle:
  digest=hashlib.file_digest(handle,'sha512').hexdigest()
  assert digest==EXPECTED_SHA512
  with mmap.mmap(handle.fileno(),0,access=mmap.ACCESS_READ) as raw:
   found={key:raw.find(value.encode())>=0 for key,value in PUBLIC_EXCERPTS.items()}
   tag=raw.find(b'yaml:"inheritMcp,omitempty"')>=0
 manifest=binary.parent/'verified.json'
 version=None
 if manifest.is_file() and not manifest.is_symlink() and manifest.stat().st_size<=65536:
  data=json.loads(manifest.read_text(encoding='utf-8'))
  if isinstance(data,dict) and isinstance(data.get('version'),str) and len(data['version'])<=32:version=data['version']
 assert all(found.values()) and tag
 print(json.dumps({'scope':'public_installed_CLI_binary_MCP_agent_Metadata_no_execution',
  'binary_sha512':digest,'binary_size_bytes':binary.stat().st_size,
  'public_verification_manifest_version':version,'public_excerpts':PUBLIC_EXCERPTS,
  'literal_matches':found,'Go_reflection_yaml_tag':'inheritMcp,omitempty','yaml_tag_present':tag,
  'interpretation':'The installed binary advertises this Markdown field. Runtime MCP inheritance, tools availability and successful inference require a separate explicit canary.',
  'extractor_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
  'CLI_executions':0,'provider_requests':0,'private_profile_reads':0,'application_imports':0},indent=2))
