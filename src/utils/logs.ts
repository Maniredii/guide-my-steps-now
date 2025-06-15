
let logs: string[] = [];

export function addLog(entry: string) {
  logs.push(`${new Date().toLocaleString()} - ${entry}`);
  if (logs.length > 250) logs = logs.slice(-200); // cap log size
}
export function downloadLogs() {
  const txt = logs.join("\n");
  const blob = new Blob([txt], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `vision_guide_logs_${Date.now()}.txt`;
  a.click();
}
export function clearLogs() {
  logs = [];
}
export function getLogs() {
  return logs;
}
