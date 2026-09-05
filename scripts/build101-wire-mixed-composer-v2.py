from pathlib import Path

source_path = Path('scripts/build101-wire-mixed-composer.py')
script = source_path.read_text()
label = "'mixed pending render'"
idx = script.find(label)
if idx < 0:
    raise SystemExit('mixed pending render label not found')
start = script.rfind('source = replace_once(source,', 0, idx)
if start < 0:
    raise SystemExit('mixed pending render call start not found')
end = script.find('\n\nsource = replace_once(source,', idx)
if end < 0:
    raise SystemExit('mixed pending render call end not found')
call = script[start:end]
if call.count("const pending = state.phase === 'waiting_approval'") != 1:
    raise SystemExit('unexpected pending-render patch call shape')
# Convert only this known two-occurrence target anchor from cardinality-exact helper to first-occurrence replacement.
first_arg = call.find('source,')
last_label = call.rfind(", 'mixed pending render')")
if first_arg < 0 or last_label < 0:
    raise SystemExit('could not rewrite mixed pending render call')
args = call[first_arg + len('source,'):last_label]
replacement = 'source = source.replace(' + args.strip() + ', 1)'
script = script[:start] + replacement + script[end:]

namespace = {'__name__': '__main__', '__file__': str(source_path)}
exec(compile(script, str(source_path), 'exec'), namespace, namespace)
