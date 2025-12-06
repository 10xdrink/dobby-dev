const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCENARIOS_DIR = './performance/scenarios';
const REPORT_DIR = './performance/reports';


if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR);

const files = fs.readdirSync(SCENARIOS_DIR).filter(f => f.endsWith('.yml'));

for (const file of files) {
  console.log(`\n Running Artillery test: ${file}`);
  const reportFile = path.join(REPORT_DIR, file.replace('.yml', '.json'));
  execSync(`npx artillery run ${path.join(SCENARIOS_DIR, file)} -o ${reportFile}`, { stdio: 'inherit' });
}

console.log("\n All performance tests completed!");
