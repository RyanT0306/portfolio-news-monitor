// Made-up articles for trying the app. Each one shows a different behaviour.

export interface Example {
  title: string;
  text: string;
}

export const EXAMPLES: Example[] = [
  {
    title: "Iron ore slides",
    // Names no company, so FinBERT finds nothing while Claude links it to miners.
    text:
      "Iron ore futures fell 7% in Singapore overnight to their lowest level in two years, after China's " +
      "steel output dropped for a fourth straight month. Port stockpiles in China have climbed to a record, " +
      "and analysts warned that Pilbara producers face a sharp squeeze on margins if prices stay below " +
      "US$90 a tonne into the new year.",
  },
  {
    title: "CommBank record profit",
    text:
      "Commonwealth Bank posted a record first-half cash profit of A$5.3 billion, beating analyst forecasts, " +
      "as lower funding costs lifted its net interest margin. CommBank also raised its interim dividend and " +
      "said bad debts remained low despite cost-of-living pressure on households. The bank expects mortgage " +
      "competition to stay intense through the rest of the year.",
  },
  {
    title: "CSL cuts guidance",
    text:
      "CSL shares fell 9% on Tuesday after the biotech cut its full-year earnings guidance, citing weaker " +
      "demand for flu vaccines in the United States at its Seqirus division. The company said its plasma " +
      "business was performing in line with expectations, but warned that vaccine sales may not recover " +
      "until the next northern hemisphere season.",
  },
];
