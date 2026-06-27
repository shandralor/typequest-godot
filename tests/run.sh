#!/usr/bin/env bash
# Run the headless logic test suite. Each test quits with its failure count, so a
# non-zero exit means a real failure. Usage: tests/run.sh
set -u
cd "$(dirname "$0")/.."
godot --headless --import --path . >/dev/null 2>&1

tests=(test_fnv1a test_logic test_content test_purity test_render_logic test_menu_flow)
fail=0
for t in "${tests[@]}"; do
	godot --headless --script "res://tests/$t.gd" >"/tmp/tq_$t.log" 2>&1
	code=$?
	tail -1 "/tmp/tq_$t.log" | grep -qiE 'error' && code=1
	if [ "$code" -eq 0 ]; then
		echo "PASS  $t"
	else
		echo "FAIL  $t (exit $code)"
		grep -E 'FAIL|PROBLEM|VIOLATION|Error' "/tmp/tq_$t.log" | head
		fail=1
	fi
done
echo "------"
[ "$fail" -eq 0 ] && echo "ALL TESTS PASSED" || echo "TESTS FAILED"
exit "$fail"
