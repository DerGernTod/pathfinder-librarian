// Runs once before all test workers to set up a clean database baseline.
// oxlint-disable-next-line import/no-default-export -- Playwright requires default export for globalSetup
export default async function globalSetup() {
    const res = await fetch("http://localhost:3000/api/test/reset-db", { method: "POST" });
    if (!res.ok) {
        throw new Error("Failed to reset DB in global setup");
    }
}
