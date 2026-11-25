const { runAllTests } = require('../js/tests/testSuite');

const summary = runAllTests();
console.log(`\nMedAssist AI — SRS Verification Suite`);
console.log(`Passed: ${summary.passed}/${summary.total} | Failed: ${summary.failed}\n`);

summary.results.forEach((r) => {
  const status = r.passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] (${r.reqId}) ${r.name} (${r.durationMs}ms)`);
  if (!r.passed) {
    console.log(`       Error: ${r.error}`);
  }
});

process.exit(summary.failed > 0 ? 1 : 0);
