export function occupiesCivilNight(
  checkIn: string,
  checkOut: string,
  day: string,
) {
  return checkIn <= day && day < checkOut;
}
