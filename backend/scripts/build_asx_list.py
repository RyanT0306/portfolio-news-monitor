"""Regenerate data/asx_companies.csv from the official ASX listed-companies file.

Usage:  python scripts/build_asx_list.py

If the download fails the existing CSV is left untouched.
"""

import csv
import io
import sys
import urllib.request
from pathlib import Path

SOURCE_URL = "https://www.asx.com.au/asx/research/ASXListedCompanies.csv"
OUT = Path(__file__).resolve().parent.parent / "data" / "asx_companies.csv"

# Everyday names the press uses that don't fall out of the legal name.
ALIASES: dict[str, list[str]] = {
    "AGL": ["AGL Energy"],
    "ALL": ["Aristocrat"],
    "ALX": ["Atlas Arteria"],
    "AMC": ["Amcor"],
    "ANZ": ["ANZ Bank", "ANZ Group"],
    "APA": ["APA Group"],
    "ASX": ["ASX Ltd", "Australian Securities Exchange"],
    "BHP": ["BHP Group", "BHP Billiton"],
    "BSL": ["BlueScope"],
    "BXB": ["Brambles"],
    "CAR": ["CAR Group", "Carsales"],
    "CBA": ["CommBank", "Commonwealth Bank"],
    "COH": ["Cochlear"],
    "COL": ["Coles"],
    "CPU": ["Computershare"],
    "CSL": ["CSL Ltd", "CSL Behring", "Seqirus"],
    "EVN": ["Evolution Mining"],
    "FMG": ["Fortescue"],
    "GMG": ["Goodman"],
    "IAG": ["Insurance Australia", "NRMA Insurance"],
    "JBH": ["JB Hi-Fi"],
    "MIN": ["Mineral Resources", "MinRes"],
    "MPL": ["Medibank"],
    "MQG": ["Macquarie", "Macquarie Group"],
    "NAB": ["National Australia Bank", "NAB"],
    "NST": ["Northern Star"],
    "ORG": ["Origin", "Origin Energy"],
    "PLS": ["Pilbara Minerals", "PLS"],
    "QAN": ["Qantas"],
    "QBE": ["QBE Insurance"],
    "REA": ["REA Group", "realestate.com.au"],
    "RHC": ["Ramsay Health Care", "Ramsay"],
    "RIO": ["Rio Tinto", "Rio"],
    "RMD": ["ResMed"],
    "S32": ["South32"],
    "SHL": ["Sonic Healthcare"],
    "STO": ["Santos"],
    "SUN": ["Suncorp"],
    "TCL": ["Transurban"],
    "TLS": ["Telstra"],
    "TLC": ["The Lottery Corporation", "Lottery Corp"],
    "WBC": ["Westpac"],
    "WDS": ["Woodside", "Woodside Energy"],
    "WES": ["Wesfarmers", "Bunnings", "Kmart"],
    "WOW": ["Woolworths", "Woolies"],
    "WTC": ["WiseTech", "WiseTech Global"],
    "XRO": ["Xero"],
}

_SMALL_WORDS = {"of", "and", "the", "for", "&"}
_FIXED_CASE = {"the": "The", "ltd": "Ltd", "inc": "Inc", "co": "Co", "plc": "PLC"}


def display_name(legal: str) -> str:
    """'COMMONWEALTH BANK OF AUSTRALIA.' -> 'Commonwealth Bank of Australia'."""
    words = []
    for i, w in enumerate(legal.strip().rstrip(".").split()):
        lower = w.lower()
        if i > 0 and lower in _SMALL_WORDS:
            words.append(lower)
        elif lower in _FIXED_CASE:
            words.append(_FIXED_CASE[lower])
        elif len(w) <= 3 or not any(c in "AEIOU" for c in w):
            words.append(w)  # acronyms such as BHP, CSL, JB
        else:
            words.append("-".join(p.capitalize() for p in w.split("-")))
    return " ".join(words)


def main() -> int:
    try:
        with urllib.request.urlopen(SOURCE_URL, timeout=30) as resp:
            text = resp.read().decode("utf-8-sig")
    except OSError as exc:
        print(f"Couldn't download {SOURCE_URL}: {exc}. Keeping the existing file.", file=sys.stderr)
        return 1

    # The file starts with a title line and a blank line before the header row.
    lines = text.splitlines()
    header_at = next(i for i, line in enumerate(lines) if line.startswith("Company name"))
    rows = list(csv.DictReader(io.StringIO("\n".join(lines[header_at:]))))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["ticker", "name", "industry", "aliases"])
        for row in sorted(rows, key=lambda r: r["ASX code"]):
            ticker = row["ASX code"].strip().upper()
            writer.writerow([
                ticker,
                display_name(row["Company name"]),
                row["GICS industry group"].strip(),
                "|".join(ALIASES.get(ticker, [])),
            ])
    print(f"Wrote {len(rows)} companies to {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
