export const COUNTRIES = [
  { name: "Saudi Arabia", flag: "🇸🇦" },
  { name: "Kuwait", flag: "🇰🇼" },
  { name: "UAE", flag: "🇦🇪" },
  { name: "Bahrain", flag: "🇧🇭" },
  { name: "Qatar", flag: "🇶🇦" },
  { name: "Oman", flag: "🇴🇲" },
  { name: "Egypt", flag: "🇪🇬" },
  { name: "Jordan", flag: "🇯🇴" },
  { name: "Lebanon", flag: "🇱🇧" },
  { name: "Iraq", flag: "🇮🇶" },
  { name: "Morocco", flag: "🇲🇦" },
  { name: "Tunisia", flag: "🇹🇳" },
  { name: "United States", flag: "🇺🇸" },
  { name: "United Kingdom", flag: "🇬🇧" },
  { name: "Germany", flag: "🇩🇪" },
  { name: "France", flag: "🇫🇷" },
  { name: "Canada", flag: "🇨🇦" },
  { name: "Australia", flag: "🇦🇺" },
  { name: "India", flag: "🇮🇳" },
  { name: "Pakistan", flag: "🇵🇰" },
  { name: "Turkey", flag: "🇹🇷" },
  { name: "Philippines", flag: "🇵🇭" },
  { name: "Bangladesh", flag: "🇧🇩" },
];

export function countryOptions() {
  return COUNTRIES.map((c) => ({ id: c.name, label: c.name, prefix: c.flag }));
}
