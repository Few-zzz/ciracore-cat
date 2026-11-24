// Next.js เรียก register() ครั้งเดียวตอนเซิร์ฟเวอร์เริ่ม -> ดึงข้อมูลจาก Google Sheet มาเติม
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSheetPull } = await import("./lib/sheets");
    startSheetPull();
  }
}
