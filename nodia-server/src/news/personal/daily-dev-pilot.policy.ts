export function dailyDevPilotAllowed(owner: string): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.NEWS_DAILY_DEV_LOCAL_OWNER_ID === owner &&
    /^[1-9]\d{0,18}$/u.test(owner) &&
    BigInt(owner) <= 9223372036854775807n
  );
}
