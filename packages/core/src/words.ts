/* The words a view says of its own, in one table. Everything else it says is the catalog's (a label), the engine's (a
 * value) or the author's (a title, a layer's label). A container hands a view its own words with its rules
 * (`rules.words`), any of these and no others, and English is said for the rest.
 *
 * An entry is a template: `{name}` is filled with what the view has for it, already in the container's locale. A name
 * may ask for an English form of what fills it, which a translation simply does not ask for: `{dimension:lower}` in
 * lower case, and `{dimension:plural}` in lower case and, of any count but one, the plural. An entry that depends on
 * a count gives a form for each plural category the language has (Intl.PluralRules), and `other` for the rest.
 *
 * ponytail: the clauses of the sentence come in English's order, each from its own template. A language that orders
 * them otherwise needs the sentence as one template, which this is not yet. And the letters of a unit ("ms", "kB",
 * "2m 05s") are not here: they are symbols, and Intl.DurationFormat says them in a locale where a host's browsers have it. */

/** A template, or one for each plural category of a count, with `other` for those not named. */
export type Word = string | ({ other: string } & Partial<Record<Intl.LDMLPluralRule, string>>);

export const WORDS = {
  // A change from the period before, beside the number and in a list's column.
  up: '▲ {change}', down: '▼ {change}', noPrior: 'No prior period', isNew: 'New', noChange: 'No change',
  onPrevious: '{change} on the previous period',
  // A range, a bin by both its ends, a place in an order.
  now: 'right now', lastDays: { one: 'last day', other: 'last {count} days' },
  bin: '{start}–{end}', binTo: '{start} to {end}',
  nth: { one: '{n}st', two: '{n}nd', few: '{n}rd', other: '{n}th' },
  // The number's note, the key to a unit's glyphs, and what stands in for marks with nothing to draw.
  sumOfDaily: 'Sum of daily counts', target: 'Target {value}', top: 'Top: {name}', eachIs: 'Each is {value}',
  nothingYet: '{metric}: nothing yet', nothingInPeriod: '{metric}: nothing in this period yet',
  // The sentence: a metric's clause, what follows it of its change and its target, then what closes it.
  said: '{metric}: {value}{over}', saidNow: '{metric}: {value} right now.', over: ' in the {range}', noFigure: 'no figure',
  saidUp: ', up {change} on the previous period', saidDown: ', down {change} on the previous period',
  saidLevel: ', level with the previous period', saidNoPrior: ', with no prior period to compare',
  saidTarget: ', {share} of its target of {target}', sentence: '{clauses}.',
  saidSumOfDaily: 'This is a sum of daily counts, not a unique count.',
  nothingRecorded: '{metric}: nothing recorded{over}.',
  topSaid: 'The top {dimension:lower} is {name}.', topSaidAt: 'The top {dimension:lower} is {name}, at {share}.',
  // What an answer is filtered to: a dimension held to values, or between two of them.
  filtered: 'Filtered to {filter}.', held: '{dimension:lower} {values}', heldFrom: '{dimension:lower} from {from}',
  heldFromTo: '{dimension:lower} from {from} to {to}', heldUpTo: '{dimension:lower} up to {to}',
  or: ' or ', comma: ', ', and: ', and ',
  // The readout, the table and the notes.
  soFar: 'so far', notShown: '{count} {dimension:plural} not shown', noData: 'No data', noDataOf: 'no data',
  previous: 'previous period', theMost: 'the most {said}', counted: '{count} {dimension:plural}', by: '{a} by {b}', loading: 'Loading',
} satisfies Record<string, Word>;

/** The table's entries by name. */
export type Words = Record<keyof typeof WORDS, Word>;

/** More than one of a dimension's values, by its label, in English: "pages", "countries". */
export const plural = (label: string) => label.replace(/([^aeiou])y$/, '$1ie') + 's';
/** A label for `n` of a thing, in English: itself for one, its plural for any other number. */
export const many = (n: number, label: string) => (n === 1 ? label : plural(label));

/** A container's words, checked: each is one a view says, and a template or a form for each count. */
export function checkWords(words: unknown): asserts words is Partial<Words> {
  if (!words || typeof words !== 'object' || Array.isArray(words)) throw new Error('The words are ' + JSON.stringify(words) + ', and they are a table: an object from an entry\'s name to its template, such as { "noData": "Keine Daten" }. Leave "words" out for English.');
  for (const [k, w] of Object.entries(words)) {
    if (!Object.hasOwn(WORDS, k)) throw new Error('The words have "' + k + '", which is not something a view says. It says: ' + Object.keys(WORDS).join(', ') + '. Correct the name, or remove it.');
    const forms = typeof w === 'string' ? [w] : w && typeof w === 'object' && typeof (w as { other?: unknown }).other === 'string' ? Object.values(w) : null;
    if (!forms || forms.some((f) => typeof f !== 'string')) throw new Error('The words give "' + k + '" as ' + JSON.stringify(w) + '. Give a template, as English has it (' + JSON.stringify(WORDS[k as keyof Words]) + '), or one for each plural form of a count, with "other" among them.');
  }
}
