/** Apple price lists. Countries on the US$17.99 / US$14.99 Business tier use the US Plus prices when Apple did not schedule a local change. */
export type SubscriptionPriceRow = {
  country: string;
  plusStandard: string | null;
  plusCoupon: string | null;
  businessStandard: string;
  businessCoupon: string;
};

export const SUBSCRIPTION_PRICES: readonly SubscriptionPriceRow[] = [
  {
    "country": "United States",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Canada",
    "plusStandard": "CA$12.99",
    "plusCoupon": "CA$9.99",
    "businessStandard": "CA$19.99",
    "businessCoupon": "CA$17.99"
  },
  {
    "country": "Mexico",
    "plusStandard": "MX$129.00",
    "plusCoupon": "MX$99.00",
    "businessStandard": "MX$299.00",
    "businessCoupon": "MX$249.00"
  },
  {
    "country": "Panama",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Dominican Republic",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Spain",
    "plusStandard": "EUR €14.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €14.99"
  },
  {
    "country": "Colombia",
    "plusStandard": "COP $14.900",
    "plusCoupon": "COP $9.900",
    "businessStandard": "COP $59.900",
    "businessCoupon": "COP $49.900"
  },
  {
    "country": "Venezuela",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Australia",
    "plusStandard": "A$14.99",
    "plusCoupon": "A$14.99",
    "businessStandard": "A$29.99",
    "businessCoupon": "A$22.99"
  },
  {
    "country": "Anguilla",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Antigua and Barbuda",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Argentina",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Bahamas",
    "plusStandard": "US$9.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Barbados",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Belize",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Bermuda",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Bolivia",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Brazil",
    "plusStandard": "R$79.90",
    "plusCoupon": "R$59.90",
    "businessStandard": "R$119.90",
    "businessCoupon": "R$99.90"
  },
  {
    "country": "British Virgin Islands",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Cayman Islands",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Chile",
    "plusStandard": "CLP $3.990",
    "plusCoupon": "CLP $2.990",
    "businessStandard": "CLP $19.990",
    "businessCoupon": "CLP $17.990"
  },
  {
    "country": "Costa Rica",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Dominica",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Ecuador",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "El Salvador",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Grenada",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Guatemala",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Guyana",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Honduras",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Jamaica",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Montserrat",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Nicaragua",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Paraguay",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Peru",
    "plusStandard": "PEN S/59.90",
    "plusCoupon": "PEN S/44.90",
    "businessStandard": "PEN S/79.90",
    "businessCoupon": "PEN S/69.90"
  },
  {
    "country": "St. Kitts and Nevis",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "St. Lucia",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "St. Vincent and the Grenadines",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Suriname",
    "plusStandard": "US$9.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Trinidad and Tobago",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Turks and Caicos Islands",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Uruguay",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Albania",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Austria",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Belarus",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Belgium",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Bosnia and Herzegovina",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Bulgaria",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Croatia",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Cyprus",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Czech Republic",
    "plusStandard": "CZK Kč249.00",
    "plusCoupon": "CZK Kč249.00",
    "businessStandard": "CZK Kč499.00",
    "businessCoupon": "CZK Kč399.00"
  },
  {
    "country": "Denmark",
    "plusStandard": "DKK 89.00",
    "plusCoupon": "DKK 89.00",
    "businessStandard": "DKK 149.00",
    "businessCoupon": "DKK 129.00"
  },
  {
    "country": "Estonia",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Finland",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "France",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Georgia",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Germany",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Greece",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Hungary",
    "plusStandard": "HUF Ft4,490",
    "plusCoupon": "HUF Ft4,490",
    "businessStandard": "HUF Ft7,990",
    "businessCoupon": "HUF Ft6,990"
  },
  {
    "country": "Iceland",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Ireland",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Italy",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Kosovo",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Latvia",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Lithuania",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Luxembourg",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Malta",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Moldova",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Montenegro",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €17.99",
    "businessCoupon": "EUR €12.99"
  },
  {
    "country": "Netherlands",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "North Macedonia",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Norway",
    "plusStandard": "NOK 129.00",
    "plusCoupon": "NOK 129.00",
    "businessStandard": "NOK 229.00",
    "businessCoupon": "NOK 199.00"
  },
  {
    "country": "Poland",
    "plusStandard": "PLN zł49.99",
    "plusCoupon": "PLN zł49.99",
    "businessStandard": "PLN zł79.99",
    "businessCoupon": "PLN zł69.99"
  },
  {
    "country": "Portugal",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Romania",
    "plusStandard": "RON 49.99",
    "plusCoupon": "RON 49.99",
    "businessStandard": "RON 99.99",
    "businessCoupon": "RON 79.99"
  },
  {
    "country": "Russia",
    "plusStandard": "RUB ₽899.00",
    "plusCoupon": "RUB ₽899.00",
    "businessStandard": "RUB ₽1,490",
    "businessCoupon": "RUB ₽1,290"
  },
  {
    "country": "Serbia",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Slovakia",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Slovenia",
    "plusStandard": "EUR €9.99",
    "plusCoupon": "EUR €9.99",
    "businessStandard": "EUR €19.99",
    "businessCoupon": "EUR €17.99"
  },
  {
    "country": "Sweden",
    "plusStandard": "SEK 129.00",
    "plusCoupon": "SEK 129.00",
    "businessStandard": "SEK 229.00",
    "businessCoupon": "SEK 199.00"
  },
  {
    "country": "Switzerland",
    "plusStandard": "CHF 9.00",
    "plusCoupon": "CHF 9.00",
    "businessStandard": "CHF 15.00",
    "businessCoupon": "CHF 14.00"
  },
  {
    "country": "Türkiye",
    "plusStandard": "TRY ₺499.99",
    "plusCoupon": "TRY ₺499.99",
    "businessStandard": "TRY ₺999.99",
    "businessCoupon": "TRY ₺799.99"
  },
  {
    "country": "Ukraine",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "United Kingdom",
    "plusStandard": "GBP £9.99",
    "plusCoupon": "GBP £9.99",
    "businessStandard": "GBP £17.99",
    "businessCoupon": "GBP £14.99"
  },
  {
    "country": "Afghanistan",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Armenia",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Azerbaijan",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Bahrain",
    "plusStandard": "US$9.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Bhutan",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Brunei",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Cambodia",
    "plusStandard": "US$9.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "China mainland",
    "plusStandard": "CN¥68.00",
    "plusCoupon": "CN¥68.00",
    "businessStandard": "CN¥128.00",
    "businessCoupon": "CN¥98.00"
  },
  {
    "country": "Hong Kong",
    "plusStandard": "HK$88.00",
    "plusCoupon": "HK$88.00",
    "businessStandard": "HK$148.00",
    "businessCoupon": "HK$118.00"
  },
  {
    "country": "India",
    "plusStandard": "INR ₹999.00",
    "plusCoupon": "INR ₹999.00",
    "businessStandard": "INR ₹1,999",
    "businessCoupon": "INR ₹1,499"
  },
  {
    "country": "Indonesia",
    "plusStandard": "IDR Rp169.000",
    "plusCoupon": "IDR Rp199.000",
    "businessStandard": "IDR Rp299.000",
    "businessCoupon": "IDR Rp249.000"
  },
  {
    "country": "Iraq",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Israel",
    "plusStandard": "ILS ₪34.90",
    "plusCoupon": "ILS ₪29.90",
    "businessStandard": "ILS ₪59.90",
    "businessCoupon": "ILS ₪49.90"
  },
  {
    "country": "Japan",
    "plusStandard": "JPY ¥1,500",
    "plusCoupon": "JPY ¥1,500",
    "businessStandard": "JPY ¥3,000",
    "businessCoupon": "JPY ¥2,500"
  },
  {
    "country": "Jordan",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Kazakhstan",
    "plusStandard": "KZT ₸5,990",
    "plusCoupon": "KZT ₸5,990",
    "businessStandard": "KZT ₸9,990",
    "businessCoupon": "KZT ₸8,990"
  },
  {
    "country": "Korea, Republic of",
    "plusStandard": "KRW ₩17,000",
    "plusCoupon": "KRW ₩17,000",
    "businessStandard": "KRW ₩29,000",
    "businessCoupon": "KRW ₩25,000"
  },
  {
    "country": "Kuwait",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Kyrgyzstan",
    "plusStandard": "US$9.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Laos",
    "plusStandard": "US$9.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Lebanon",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Macau",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Malaysia",
    "plusStandard": "MYR RM49.90",
    "plusCoupon": "MYR RM49.90",
    "businessStandard": "MYR RM79.90",
    "businessCoupon": "MYR RM69.90"
  },
  {
    "country": "Maldives",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Mongolia",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Myanmar",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Nepal",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Oman",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Pakistan",
    "plusStandard": "PKR Rs2,900",
    "plusCoupon": "PKR Rs2,900",
    "businessStandard": "PKR Rs4,900",
    "businessCoupon": "PKR Rs3,900"
  },
  {
    "country": "Philippines",
    "plusStandard": "PHP ₱599.00",
    "plusCoupon": "PHP ₱599.00",
    "businessStandard": "PHP ₱999.00",
    "businessCoupon": "PHP ₱999.00"
  },
  {
    "country": "Qatar",
    "plusStandard": "QAR 39.99",
    "plusCoupon": "QAR 39.99",
    "businessStandard": "QAR 69.99",
    "businessCoupon": "QAR 49.99"
  },
  {
    "country": "Saudi Arabia",
    "plusStandard": "SAR 39.99",
    "plusCoupon": "SAR 39.99",
    "businessStandard": "SAR 79.99",
    "businessCoupon": "SAR 59.99"
  },
  {
    "country": "Singapore",
    "plusStandard": "S$14.98",
    "plusCoupon": "S$14.98",
    "businessStandard": "S$24.98",
    "businessCoupon": "S$19.98"
  },
  {
    "country": "Sri Lanka",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Taiwan",
    "plusStandard": "NT$320",
    "plusCoupon": "NT$320",
    "businessStandard": "NT$590",
    "businessCoupon": "NT$490"
  },
  {
    "country": "Tajikistan",
    "plusStandard": "US$9.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Thailand",
    "plusStandard": "THB ฿399.00",
    "plusCoupon": "THB ฿399.00",
    "businessStandard": "THB ฿699.00",
    "businessCoupon": "THB ฿499.00"
  },
  {
    "country": "Turkmenistan",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "United Arab Emirates",
    "plusStandard": "AED 39.99",
    "plusCoupon": "AED 39.99",
    "businessStandard": "AED 69.99",
    "businessCoupon": "AED 59.99"
  },
  {
    "country": "Uzbekistan",
    "plusStandard": "US$9.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Vietnam",
    "plusStandard": "VND ₫299,000",
    "plusCoupon": "VND ₫299,000",
    "businessStandard": "VND ₫499,000",
    "businessCoupon": "VND ₫499,000"
  },
  {
    "country": "Yemen",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Algeria",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Angola",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Benin",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Botswana",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Burkina Faso",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Cameroon",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Cape Verde",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Chad",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Congo, Democratic Republic of the",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Congo, Republic of the",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Côte d’Ivoire",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Egypt",
    "plusStandard": "EGP E£499.99",
    "plusCoupon": "EGP E£499.99",
    "businessStandard": "EGP E£999.99",
    "businessCoupon": "EGP E£799.99"
  },
  {
    "country": "Eswatini",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Gabon",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Gambia",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Ghana",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Guinea-Bissau",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Kenya",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Liberia",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Libya",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Madagascar",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Malawi",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Mali",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Mauritania",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Mauritius",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Morocco",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Mozambique",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Namibia",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Niger",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Nigeria",
    "plusStandard": "NGN ₦14,900",
    "plusCoupon": "NGN ₦14,900",
    "businessStandard": "NGN ₦29,900",
    "businessCoupon": "NGN ₦24,900"
  },
  {
    "country": "Rwanda",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "São Tomé and Príncipe",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Senegal",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Seychelles",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Sierra Leone",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "South Africa",
    "plusStandard": "ZAR R199.99",
    "plusCoupon": "ZAR R199.99",
    "businessStandard": "ZAR R399.99",
    "businessCoupon": "ZAR R299.99"
  },
  {
    "country": "Tanzania",
    "plusStandard": "TZS TSh29,900",
    "plusCoupon": "TZS TSh29,900",
    "businessStandard": "TZS TSh49,900",
    "businessCoupon": "TZS TSh39,900"
  },
  {
    "country": "Tunisia",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Uganda",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Zambia",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Zimbabwe",
    "plusStandard": "US$11.99",
    "plusCoupon": "US$11.99",
    "businessStandard": "US$19.99",
    "businessCoupon": "US$17.99"
  },
  {
    "country": "Fiji",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Micronesia",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Nauru",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "New Zealand",
    "plusStandard": "NZ$19.99",
    "plusCoupon": "NZ$19.99",
    "businessStandard": "NZ$29.99",
    "businessCoupon": "NZ$29.99"
  },
  {
    "country": "Palau",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Papua New Guinea",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Solomon Islands",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Tonga",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  },
  {
    "country": "Vanuatu",
    "plusStandard": "US$12.99",
    "plusCoupon": "US$9.99",
    "businessStandard": "US$17.99",
    "businessCoupon": "US$14.99"
  }
];
