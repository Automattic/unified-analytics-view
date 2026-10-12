import type { Catalog, MetricDef, Polarity, Query, Result, Row, Unit } from '@unified-analytics/core';
import { apportion, seeded, type Scenario } from '@unified-analytics/fixtures';

/* The engine behind the goals page: seventeen sites, one for each goal a plan can have, on one catalog. Its own
 * numbers, so the fixtures the tests sweep stay as they are. A site has its own pages, events and steps, and its
 * own size; every figure is stated for 28 days and the 28 before them. Any metric can be asked for by any dimension:
 * what the engine has no table for it divides by the dimension's weights, so the views are plausible and no more. */
type Kind = 'sum' | 'mean' | 'level' | 'signed';
/** A metric: its label, unit and polarity, its figure for 28 days and the 28 before, and how it adds up. A count or
 * money is a sum unless it says otherwise; anything else is the engine's own mean. A level is what stands at the end. */
type Def = [label: string, unit: Unit, polarity: Polarity, now: number, before: number, kind?: Kind];
const METRICS: Record<string, Def> = {
  visitors:        ['Visitors', 'count', 'up', 10531, 9437],
  pageviews:       ['Page views', 'count', 'up', 24310, 21840],
  engaged_time:    ['Engaged time', 's', 'up', 94, 88],
  present:         ['Present now', 'count', 'none', 7, 7],
  read_through:    ['Read to the end', 'ratio', 'up', 0.42, 0.4],
  recirculation:   ['Went on to another page', 'ratio', 'up', 0.31, 0.29],
  reached:         ['Still reading', 'ratio', 'up', 0.42, 0.4],
  ai_visitors:     ['Visitors from AI assistants', 'count', 'up', 842, 410],
  conversions:     ['Conversions', 'count', 'up', 612, 540],
  conversion_rate: ['Conversion rate', 'ratio', 'up', 0.058, 0.057],
  conversion_value: ['Value', 'usd', 'up', 18400, 16100],
  revenue:         ['Revenue', 'usd', 'up', 48200, 43100],
  orders:          ['Orders', 'count', 'up', 655, 602],
  customers:       ['Customers', 'count', 'up', 540, 498],
  discounts:       ['Discounts', 'usd', 'none', 3900, 3300],
  amount:          ['Net revenue', 'usd', 'up', 44100, 39800],
  subscribers:     ['Subscribers', 'count', 'up', 4820, 4610, 'level'],
  net_subscribers: ['Net subscribers', 'count', 'up', 0, 0, 'signed'],
  new_subscribers: ['New subscribers', 'count', 'up', 310, 262],
  mrr:             ['Recurring revenue', 'usd', 'up', 5508, 5139, 'level'],
  retention:       ['Still here', 'ratio', 'up', 0.34, 0.31],
  delivered:       ['Delivered', 'count', 'up', 19200, 18300],
  open_rate:       ['Opened', 'ratio', 'up', 0.46, 0.44],
  click_rate:      ['Clicked', 'ratio', 'up', 0.072, 0.068],
  shares:          ['Shares', 'count', 'up', 430, 372],
  ad_revenue:      ['Ad earnings', 'usd', 'up', 2140, 1985],
  outbound_clicks: ['Outbound clicks', 'count', 'up', 3120, 2890],
  responses:       ['Responses', 'count', 'up', 248, 212],
  custom:          ['Saved for later', 'count', 'up', 1260, 1105],
  bookings:        ['Bookings', 'count', 'up', 184, 171],
  search_clicks:   ['Clicks from search', 'count', 'up', 4310, 3980],
  search_ctr:      ['Click-through', 'ratio', 'up', 0.034, 0.031],
  searches:        ['On-site searches', 'count', 'up', 1840, 1710],
  no_result_rate:  ['Found nothing', 'ratio', 'down', 0.12, 0.15],
  not_found:       ['404s', 'count', 'down', 214, 260],
  helpful_votes:   ['Votes', 'count', 'up', 520, 470],
  helpful_rate:    ['Said it helped', 'ratio', 'up', 0.78, 0.74],
  dau:             ['Daily active', 'count', 'up', 1240, 1130, 'level'],
  wau:             ['Weekly active', 'count', 'up', 4380, 4050, 'level'],
  mau:             ['Monthly active', 'count', 'up', 11200, 10300, 'level'],
  uses:            ['Uses', 'count', 'up', 18400, 16900],
  adoption:        ['Used by', 'ratio', 'up', 0.38, 0.35],
  errors:          ['Script errors', 'count', 'down', 342, 410],
  error_users:     ['People affected', 'count', 'down', 96, 120],
  likes:           ['Likes', 'count', 'up', 2140, 1890],
  comments:        ['Comments', 'count', 'up', 760, 702],
  returning_rate:  ['Came back', 'ratio', 'up', 0.36, 0.33],
  views:           ['Views', 'count', 'up', 96, 41],
  viewers:         ['Viewers', 'count', 'up', 14, 9, 'level'],
  opened_share:    ['Opened it', 'ratio', 'up', 0.7, 0.55],
  days_waiting:    ['Days since it was sent', 'count', 'none', 6, 6, 'mean'],
  forward_viewers: ['New viewers from forwards', 'count', 'up', 5, 2],
};
/** What the catalog says of a metric beyond its unit: how its range total is made, and the range a gauge reads it against. */
const MORE: Record<string, Partial<MetricDef>> = {
  visitors: { rangeTotal: 'sum of daily' }, present: { instant: true },
  bookings: { domain: [0, 250], target: 200, bands: [100, 200] },
  helpful_rate: { domain: [0, 1], target: 0.8, bands: [0.5, 0.8] },
  read_through: { domain: [0, 1], target: 0.5, bands: [0.25, 0.5] },
  opened_share: { domain: [0, 1], target: 1, bands: [0.5, 0.9] },
};
const kindOf = (m: string): Kind => METRICS[m]![5] ?? (['count', 'usd'].includes(METRICS[m]![1]) ? 'sum' : 'mean');

type Values = [name: string, weight: number][];
/** A dimension. Its values divide a total by their weights, and are ranked by the first metric. `curve` values are
 * each a share of the first and not of the whole, as a funnel's steps are. `ordered` values keep their own order.
 * `like` is the dimension whose values it shares. A `number` dimension's names are where its bins start. */
interface Dim { label: string; type?: 'time' | 'number'; values?: Values; like?: string; curve?: boolean; ordered?: boolean; width?: number; code?: 'country' }
const even = (names: string[], weights: number[]): Values => names.map((n, i) => [n, weights[i]!]);
const DIMS: Record<string, Dim> = {
  'date.day': { label: 'Day', type: 'time' },
  page:     { label: 'Page', values: [['/', 0.3], ['/pricing', 0.2], ['/blog/launch-notes', 0.16], ['/docs/getting-started', 0.14], ['/changelog', 0.08], ['/about', 0.06], ['/contact', 0.04]] },
  landing_page: { label: 'Landing page', like: 'page' },
  channel:  { label: 'Channel', values: [['Search', 0.41], ['Direct', 0.28], ['Social', 0.14], ['AI assistants', 0.08], ['Email', 0.06], ['Other', 0.03]] },
  device:   { label: 'Device', values: [['Mobile', 0.52], ['Desktop', 0.41], ['Tablet', 0.07]] },
  browser:  { label: 'Browser', values: [['Chrome', 0.56], ['Safari', 0.28], ['Firefox', 0.07], ['Edge', 0.06], ['Other', 0.03]] },
  os:       { label: 'Operating system', values: [['iOS', 0.34], ['Android', 0.25], ['Windows', 0.22], ['macOS', 0.16], ['Linux', 0.03]] },
  weekday:  { label: 'Weekday', ordered: true, values: even(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], [1.06, 1.12, 1.1, 1.04, 0.96, 0.7, 0.72]) },
  hour:     { label: 'Hour', ordered: true, values: Array.from({ length: 24 }, (_, h): [string, number] => [(h % 12 || 12) + (h < 12 ? 'am' : 'pm'), 0.15 + Math.exp(-((h - 11) ** 2) / 18) + 0.6 * Math.exp(-((h - 20) ** 2) / 8)]) },
  city:     { label: 'Town', values: [['Halden', 0.46], ['Marlow', 0.2], ['Eastfield', 0.14], ['Wendbridge', 0.1], ['Norcott', 0.06], ['Elsewhere', 0.04]] },
  country:  { label: 'Country', code: 'country', values: [['US', 0.31], ['IN', 0.12], ['GB', 0.09], ['DE', 0.08], ['BR', 0.07], ['CA', 0.06], ['FR', 0.05], ['AU', 0.045], ['JP', 0.04], ['ES', 0.035], ['MX', 0.03], ['NG', 0.02], ['ZA', 0.015]] },
  referrer: { label: 'Referrer', values: [['reddit.com', 0.26], ['news.ycombinator.com', 0.2], ['facebook.com', 0.17], ['t.co', 0.13], ['pinterest.com', 0.1], ['linkedin.com', 0.08], ['duckduckgo.com', 0.06]] },
  campaign: { label: 'Campaign', values: [['autumn-launch', 0.34], ['newsletter-october', 0.24], ['brand-search', 0.18], ['retargeting', 0.14], ['partner-swap', 0.1]] },
  assistant: { label: 'Assistant', values: [['ChatGPT', 0.52], ['Perplexity', 0.2], ['Claude', 0.14], ['Gemini', 0.1], ['Copilot', 0.04]] },
  event:    { label: 'Event', values: [['Newsletter signup', 0.5], ['Contact form', 0.3], ['Download', 0.2]] },
  step:     { label: 'Step', curve: true, ordered: true, values: [['Visited the site', 1], ['Viewed pricing', 0.16], ['Started checkout', 0.062], ['Purchased', 0.039]] },
  contact_action: { label: 'Action', values: [['Called', 0.38], ['Got directions', 0.3], ['Sent the form', 0.2], ['Emailed', 0.12]] },
  visitor_type: { label: 'Visitor', ordered: true, values: [['New', 0.64], ['Returning', 0.36]] },
  product:  { label: 'Product', values: [['Speckled mug', 0.26], ['Pour-over set', 0.22], ['Dinner plate, set of 4', 0.2], ['Bud vase', 0.12], ['Butter dish', 0.1], ['Gift card', 0.06], ['Seconds box', 0.04]] },
  customer_type: { label: 'Customer', ordered: true, values: [['First order', 0.58], ['Ordered before', 0.42]] },
  credit_model: { label: 'Credit given to', ordered: true, values: [['First touch', 1], ['Last touch', 1], ['Every touch', 1]] },
  coupon:   { label: 'Coupon', values: [['WELCOME10', 0.4], ['AUTUMN15', 0.3], ['FREESHIP', 0.2], ['FRIENDS20', 0.1]] },
  revenue_part: { label: 'Part', curve: true, ordered: true, values: [['Gross sales', 1.17], ['Discounts', -0.09], ['Refunds', -0.05], ['Shipping', 0.04], ['Tax', -0.07]] },
  plan:     { label: 'Plan', values: [['Monthly', 0.52], ['Yearly', 0.38], ['Founding member', 0.1]] },
  email:    { label: 'Email', values: [['The October letter', 0.3], ['Why we went paid', 0.25], ['Sunday links #41', 0.2], ['Sunday links #40', 0.15], ['Welcome', 0.1]] },
  cohort:   { label: 'Joined in the week of', ordered: true, values: even(['Aug 11', 'Aug 18', 'Aug 25', 'Sep 1', 'Sep 8', 'Sep 15', 'Sep 22', 'Sep 29'], [1, 1, 1, 1, 1, 1, 1, 1]) },
  weeks_since: { label: 'Weeks since', curve: true, ordered: true, values: even(['Week 0', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7'], [1, 0.52, 0.44, 0.4, 0.37, 0.35, 0.34, 0.33]) },
  network:  { label: 'Network', values: [['WhatsApp', 0.3], ['Facebook', 0.26], ['Copy link', 0.18], ['X', 0.12], ['LinkedIn', 0.08], ['Email', 0.06]] },
  depth:    { label: 'Depth, % of the page', type: 'number', curve: true, width: 10, values: even(['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'], [1, 0.94, 0.86, 0.77, 0.69, 0.62, 0.56, 0.51, 0.47, 0.44, 0.42]) },
  visits:   { label: 'Visits in the range', type: 'number', width: 1, values: even(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], [64, 14, 7, 4.5, 3, 2.2, 1.7, 1.4, 1.2, 1]) },
  site_section: { label: 'Section', values: [['Politics', 0.3], ['Local', 0.24], ['Sport', 0.2], ['Culture', 0.14], ['Opinion', 0.12]] },
  tag:      { label: 'Tag', values: [['election', 0.3], ['housing', 0.22], ['transit', 0.18], ['schools', 0.16], ['weather', 0.14]] },
  author:   { label: 'Author', values: [['Imani Okafor', 0.3], ['Daniel Reyes', 0.24], ['Sofia Lindqvist', 0.2], ['Kenji Watanabe', 0.15], ['Staff', 0.11]] },
  destination: { label: 'Destination', values: [['rei.com', 0.34], ['amazon.com', 0.3], ['backcountry.com', 0.18], ['patagonia.com', 0.1], ['moosejaw.com', 0.08]] },
  option:   { label: 'Answer', values: [['Yes', 0.6], ['No', 0.4]] },
  service:  { label: 'Service', values: [['Cut', 0.4], ['Colour', 0.3], ['Cut and colour', 0.2], ['Styling', 0.1]] },
  search_term: { label: 'Search term', values: [['how long to isolate', 0.3], ['flu jab near me', 0.24], ['norovirus symptoms', 0.2], ['is it a cold or flu', 0.14], ['vaccine side effects', 0.12]] },
  site_search: { label: 'Searched for', values: [['reset password', 0.3], ['export data', 0.22], ['cancel plan', 0.2], ['invoice', 0.16], ['api key', 0.12]] },
  missing_url: { label: 'Missing page', values: [['/help/old-billing', 0.4], ['/docs/v1/setup', 0.26], ['/help/sso', 0.18], ['/favicon.png', 0.1], ['/help/import-csv', 0.06]] },
  helpful_answer: { label: 'Answer', ordered: true, values: [['Yes', 0.78], ['No', 0.22]] },
  organization: { label: 'Organization', values: [['Northwind Logistics', 0.26], ['City of Halden', 0.22], ['Aster Health', 0.2], ['Brightline Capital', 0.18], ['Univ. of Marlow', 0.14]] },
  feature:  { label: 'Feature', values: [['Boards', 0.34], ['Comments', 0.24], ['Search', 0.18], ['Export', 0.12], ['Automations', 0.08], ['API', 0.04]] },
  version:  { label: 'Version', ordered: true, values: [['4.2', 0.58], ['4.1', 0.27], ['4.0', 0.11], ['3.x', 0.04]] },
  error:    { label: 'Error', values: [['TypeError: x is undefined', 0.4], ['ChunkLoadError', 0.26], ['ResizeObserver loop', 0.16], ['NetworkError', 0.12], ['QuotaExceededError', 0.06]] },
  journey:  { label: 'Journey', values: [['Sign up → Create board → Invite', 0.3], ['Sign up → Create board → Leave', 0.26], ['Sign up → Leave', 0.2], ['Log in → Board → Export', 0.14], ['Log in → Search → Board', 0.1]] },
  viewer:   { label: 'Viewer', values: [['Amara Nwosu', 0.3], ['Lucas Ferreira', 0.22], ['Priya Raman', 0.18], ['Tom Becker', 0.12], ['Mei Tanaka', 0.08], ['Olu Adeyemi', 0.06], ['Hannah Weiss', 0.04]] },
  unopened: { label: 'Sent to', values: [['Jonas Lind', 0.4], ['Farah Siddiqui', 0.35], ['Marco Bianchi', 0.25]] },
  section:  { label: 'Section', ordered: true, values: [['Summary', 0.3], ['The numbers', 0.26], ['Risks', 0.2], ['Next quarter', 0.16], ['Appendix', 0.08]] },
  forwarded_by: { label: 'Forwarded by', values: [['Amara Nwosu', 0.6], ['Priya Raman', 0.4]] },
  heat:     { label: 'Interest', ordered: true, values: [['Hot', 0.3], ['Warm', 0.4], ['Cold', 0.3]] },
};
/** A companion the engine returns with a dimension's rows: what each is, by its weight. A viewer's interest is the first. */
const TAGS: Record<string, [field: string, of: (weight: number) => string]> = { viewer: ['viewer@heat', (w) => (w >= 0.2 ? 'Hot' : w >= 0.08 ? 'Warm' : 'Cold')] };
/** Metrics whose rows carry a running total: what the range held before each, and after it. */
const RUNNING = ['net_subscribers', 'amount'];

export const catalog: Catalog = {
  metrics: Object.fromEntries(Object.entries(METRICS).map(([m, [label, unit, polarity]]) => [m, { label, unit, polarity, ...(kindOf(m) === 'sum' && { rangeTotal: 'sum' as const }), ...MORE[m] }])),
  dimensions: Object.fromEntries(Object.entries(DIMS).map(([d, def]) => [d, { label: def.label, type: def.type ?? ('categorical' as const), ...(def.code && { values: def.code }) }])),
};

/** A site: how big it is beside the catalog's figures, the values its dimensions have, and the totals that are its own. */
export interface Site { name: string; scale: number; values?: Record<string, Values>; totals?: Record<string, [now: number, before: number]> }
const steps = (...s: Values): Values => s;
export const SITES: Record<string, Site> = {
  sell: { name: 'Kiln & Clay, a ceramics shop', scale: 1, values: {
    page: [['/', 0.26], ['/shop/speckled-mug', 0.2], ['/shop', 0.18], ['/shop/pour-over-set', 0.14], ['/gift-guide', 0.1], ['/cart', 0.07], ['/about', 0.05]],
    event: [['Add to cart', 0.5], ['Checkout started', 0.25], ['Purchase', 0.16], ['Newsletter signup', 0.09]] } },
  paying_supporters: { name: 'The Long Field, a paid newsletter', scale: 0.6, totals: { conversions: [86, 71], revenue: [5508, 5139] }, values: {
    page: [['/p/why-we-went-paid', 0.3], ['/', 0.24], ['/subscribe', 0.18], ['/p/the-october-letter', 0.14], ['/archive', 0.08], ['/about', 0.06]],
    event: [['Started a paid plan', 0.5], ['Renewed', 0.34], ['Upgraded to yearly', 0.16]] } },
  grow_audience: { name: 'Second Helpings, a food blog', scale: 1.8, totals: { conversions: [310, 262] }, values: {
    page: [['/recipes/one-pan-orzo', 0.3], ['/', 0.2], ['/recipes/miso-butter-noodles', 0.18], ['/recipes', 0.14], ['/subscribe', 0.1], ['/about', 0.08]],
    event: [['Newsletter signup', 0.62], ['Followed on Instagram', 0.24], ['Added the RSS feed', 0.14]] } },
  earn_attention: { name: 'The Halden Courier, local news', scale: 9, values: {
    page: [['/news/council-votes-on-tram', 0.28], ['/', 0.24], ['/sport/derby-report', 0.16], ['/news/school-closures', 0.14], ['/opinion/the-case-for-the-tram', 0.1], ['/weather', 0.08]] } },
  send_elsewhere: { name: 'Trailworthy, gear reviews', scale: 2.2, totals: { conversions: [128, 112] }, values: {
    page: [['/best-trail-shoes', 0.32], ['/tents-under-300', 0.24], ['/', 0.14], ['/rain-jackets-tested', 0.14], ['/sleeping-bags', 0.1], ['/about', 0.06]],
    event: [['Affiliate sale', 0.7], ['Deal alert signup', 0.3]], option: [['Trail running', 0.36], ['Backpacking', 0.3], ['Day hikes', 0.24], ['Car camping', 0.1]] } },
  get_contacted: { name: 'Ridgeline Plumbing', scale: 0.25, totals: { conversions: [74, 61] }, values: {
    page: [['/', 0.34], ['/emergency-callout', 0.22], ['/services/boilers', 0.16], ['/contact', 0.14], ['/reviews', 0.08], ['/areas-we-cover', 0.06]],
    event: [['Sent the quote form', 0.44], ['Called', 0.38], ['Emailed', 0.18]],
    step: steps(['Visited the site', 1], ['Opened the quote form', 0.12], ['Started typing', 0.06], ['Sent it', 0.028]) } },
  get_booked: { name: 'Studio Nine, a hair salon', scale: 0.3, totals: { conversions: [184, 171], bookings: [184, 171], revenue: [11960, 10840] }, values: {
    page: [['/', 0.3], ['/book', 0.26], ['/services', 0.18], ['/stylists', 0.12], ['/prices', 0.09], ['/gift-vouchers', 0.05]],
    event: [['Booked an appointment', 0.82], ['Bought a voucher', 0.18]],
    step: steps(['Opened booking', 1], ['Chose a service', 0.71], ['Chose a time', 0.48], ['Confirmed', 0.33]) } },
  through_the_door: { name: 'Crumb, a neighbourhood bakery', scale: 0.4, totals: { conversions: [412, 371] }, values: {
    page: [['/', 0.42], ['/menu', 0.26], ['/find-us', 0.16], ['/order-ahead', 0.1], ['/our-story', 0.06]],
    event: [['Got directions', 0.5], ['Called', 0.3], ['Ordered ahead', 0.2]], country: [['US', 0.94], ['CA', 0.03], ['GB', 0.02], ['MX', 0.01]] } },
  inform: { name: 'Halden Public Health', scale: 3, values: {
    page: [['/flu/when-to-stay-home', 0.3], ['/vaccines/where-to-get-one', 0.24], ['/', 0.16], ['/norovirus', 0.14], ['/heat-advice', 0.1], ['/contact', 0.06]] } },
  self_help: { name: 'Tally help centre', scale: 1.4, values: {
    page: [['/help/reset-password', 0.26], ['/help/export-data', 0.22], ['/help', 0.2], ['/help/billing', 0.16], ['/help/cancel', 0.1], ['/help/api-keys', 0.06]],
    search_term: [['tally reset password', 0.3], ['tally export csv', 0.24], ['cancel tally subscription', 0.2], ['tally api docs', 0.14], ['tally invoice vat', 0.12]],
    option: [['I found the answer', 0.58], ['I still need help', 0.27], ['I was looking for something else', 0.15]] } },
  build_trust: { name: 'Marlow & Finch, solicitors', scale: 0.35, totals: { conversions: [38, 33] }, values: {
    page: [['/', 0.32], ['/people', 0.22], ['/practice/employment', 0.18], ['/insights/2026-tribunal-changes', 0.14], ['/cases', 0.08], ['/contact', 0.06]],
    event: [['Downloaded a guide', 0.5], ['Sent an enquiry', 0.3], ['Called', 0.2]] } },
  recruit: { name: 'Aster Health careers', scale: 0.8, totals: { conversions: [142, 118] }, values: {
    page: [['/jobs', 0.3], ['/jobs/staff-nurse', 0.24], ['/jobs/data-engineer', 0.18], ['/life-at-aster', 0.14], ['/benefits', 0.08], ['/', 0.06]],
    event: [['Applied', 0.56], ['Saved a job', 0.3], ['Joined the talent list', 0.14]],
    step: steps(['Viewed a job', 1], ['Started applying', 0.14], ['Uploaded a CV', 0.09], ['Applied', 0.062]) } },
  cause_action: { name: 'Friends of the River Wend', scale: 0.7, totals: { conversions: [1380, 940], revenue: [21400, 15200] }, values: {
    page: [['/save-the-weir', 0.36], ['/', 0.22], ['/donate', 0.18], ['/volunteer', 0.12], ['/news/water-quality-report', 0.08], ['/about', 0.04]],
    event: [['Signed the petition', 0.62], ['Donated', 0.26], ['Signed up to volunteer', 0.12]],
    step: steps(['Opened the donate page', 1], ['Chose an amount', 0.54], ['Entered details', 0.31], ['Donated', 0.24]) } },
  get_used: { name: 'Tally, a planning app', scale: 1.2, values: {
    step: steps(['Signed up', 1], ['Made a board', 0.62], ['Invited someone', 0.31], ['Back in week two', 0.22]) } },
  bring_together: { name: 'The Allotment, a growers\' forum', scale: 0.5, values: {
    page: [['/t/blight-watch-2026', 0.3], ['/t/what-to-sow-in-october', 0.24], ['/', 0.18], ['/t/show-us-your-squash', 0.14], ['/c/beginners', 0.08], ['/t/seed-swap', 0.06]],
    feature: [['Replies', 0.4], ['New topics', 0.2], ['Photo uploads', 0.18], ['Direct messages', 0.12], ['Polls', 0.06], ['Events', 0.04]] } },
  reach_intended: { name: 'Q3 board report, a shared document', scale: 1, totals: { visitors: [14, 9], pageviews: [96, 41], viewers: [7, 4] }, values: {
    page: [['Summary', 3], ['The numbers', 2], ['Risks', 1], ['Next quarter', 1]], version: [['Final', 0.6], ['Draft 2', 0.3], ['Draft 1', 0.1]] } },
  get_decision: { name: 'Proposal: a second kitchen', scale: 1, totals: { visitors: [9, 6], pageviews: [61, 22], conversions: [4, 1], uses: [37, 12], responses: [6, 2], viewers: [5, 3], opened_share: [0.63, 0.38], forward_viewers: [2, 0] }, values: {
    unopened: [['Dev Malhotra', 0.4], ['Anna Kowalski', 0.35], ['Yusuf Demir', 0.25]], forwarded_by: [['Ines Duarte', 0.5], ['Sunita Rao', 0.5]],
    page: [['The ask', 2], ['Costs', 2], ['Timeline', 1]], section: [['The ask', 0.22], ['Costs', 0.36], ['Timeline', 0.2], ['Risks', 0.14], ['Appendix', 0.08]],
    viewer: [['Ines Duarte', 0.34], ['Rob Callahan', 0.26], ['Sunita Rao', 0.2], ['Peter Holm', 0.12], ['Grace Liu', 0.08]],
    event: [['Approved', 0.5], ['Asked a question', 0.5]], option: [['Approve', 0.5], ['Approve with changes', 0.33], ['Decline', 0.17]],
    feature: [['Opened the cost sheet', 0.4], ['Commented', 0.3], ['Downloaded the PDF', 0.2], ['Shared the link', 0.1]] } },
};

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const DAY = 86400000, TODAY = Date.UTC(2026, 9, 5), SPAN = 56;
const sum = (ns: number[]) => ns.reduce((s, n) => s + n, 0);

export function runQuery(q: Query, scenario: Scenario = 'typical', site: Site = SITES.sell!): Result {
  const metrics = q.metrics || [], dims = q.by || [];
  for (const m of metrics) if (!METRICS[m]) throw new Error('Unknown metric "' + m + '". The catalog has: ' + Object.keys(METRICS).join(', ') + '.');
  for (const d of dims) if (!DIMS[d]) throw new Error('Unknown dimension "' + d + '". The catalog has: ' + Object.keys(DIMS).join(', ') + '.');
  if (dims.length > 2 || (dims.length === 2 && dims[0] === dims[1])) throw new Error('A query is by one dimension or by two different ones. This one is by: ' + dims.join(', ') + '.');
  const live = metrics.includes('present');
  if (live && (metrics.length > 1 || dims.length > 1 || (dims[0] && dims[0] !== 'page'))) throw new Error('"present" is an instantaneous count. Query it alone, optionally by page.');
  const days = Math.min(28, parseInt(q.range || '') || 28), wantPrev = q.compare === 'previous', hasPrev = wantPrev && scenario !== 'no-prior';
  const meta: Result['meta'] = { range: days + 'd', compare: q.compare || null, notes: [] }, totals: Result['totals'] = {};
  if (scenario === 'empty') {
    for (const m of metrics) { totals[m] = 0; if (wantPrev) totals[m + '@previous'] = null; }
    meta.empty = true;
    return dims.length === 2 ? { rows: [], totals, totalsBy: { [dims[0]!]: [], [dims[1]!]: [] }, meta } : { rows: [], totals, meta };
  }
  const valuesOf = (d: string): Values => site.values?.[d] ?? (DIMS[d]!.like ? valuesOf(DIMS[d]!.like!) : DIMS[d]!.values!);
  if (live) {
    const rows = valuesOf('page').slice(0, 4).map(([page], i): Row => ({ page, present: [3, 2, 1, 1][i]! }));
    return { rows: dims.length ? rows : [], totals: { present: sum(rows.map((r) => r.present as number)) }, meta: { ...meta, range: 'now' } };
  }
  const rnd = (...key: (string | number)[]) => seeded(hash([site.name, ...key].join('|')));
  // A value as the engine states it: money that is a mean to the cent, a rate to a tenth of a percent, anything else whole.
  const fit = (m: string, n: number) => { const u = METRICS[m]![1], p = u === 'ratio' ? 1000 : u === 'usd' && kindOf(m) === 'mean' ? 100 : 1; return Math.round(n * p) / p; };
  const rate = (m: string, n: number) => fit(m, METRICS[m]![1] === 'ratio' ? Math.min(0.99, n) : n);
  // A change day on day falls below zero. Its total is the sum of its days, so the two cannot disagree.
  const signed = (m: string) => { const r = rnd(m, 'signed'); return Array.from({ length: SPAN }, (_, i) => Math.round((r() - 0.42) * 36 * site.scale * (i === SPAN - 1 ? 0.42 : 1))); };
  const total = (m: string): [number, number] => {
    const k = kindOf(m), own = site.totals?.[m];
    if (k === 'signed') { const s = signed(m); return [sum(s.slice(SPAN - days)), sum(s.slice(SPAN - 2 * days, SPAN - days))]; }
    const [now, before] = own ?? (METRICS[m]!.slice(3, 5) as [number, number]), f = (own || k === 'mean' ? 1 : site.scale) * (k === 'sum' ? days / 28 : 1);
    return [fit(m, now * f), fit(m, before * f)];
  };
  for (const m of metrics) { const [now, before] = total(m); totals[m] = now; if (wantPrev) totals[m + '@previous'] = hasPrev ? before : null; }

  type Pair = [now: number[], before: number[]];
  /** A metric day by day: the week's rhythm, a slow climb and some noise, and today part done. */
  function daily(m: string): Pair {
    const k = kindOf(m), [now, before] = total(m), r = rnd(m, 'daily');
    if (k === 'signed') { const s = signed(m); return [s.slice(SPAN - days), s.slice(SPAN - 2 * days, SPAN - days)]; }
    const shape = Array.from({ length: SPAN }, (_, i) => [0.74, 1.05, 1.1, 1.08, 1.03, 0.96, 0.78][new Date(TODAY - (SPAN - 1 - i) * DAY).getUTCDay()]! * (0.9 + 0.2 * i / SPAN) * (0.85 + 0.3 * r()) * (i === SPAN - 1 ? 0.42 : 1));
    const noise = Array.from({ length: SPAN }, () => r());
    const window = (end: number, t: number) => {
      if (k === 'sum') return apportion(t, shape.slice(end - days, end));
      // A level climbs to where it stands. A mean wanders about itself.
      return Array.from({ length: days }, (_, i) => (k === 'level' ? (i === days - 1 ? t : Math.round(t * (1 - 0.08 * (days - 1 - i) / 27) * (0.995 + 0.01 * noise[end - days + i]!))) : rate(m, t * (0.9 + 0.2 * noise[end - days + i]!))));
    };
    return [window(SPAN, now), window(SPAN - days, before)];
  }
  /** A metric by a dimension's values, in the dimension's own order. */
  function across(m: string, d: string): Pair {
    const k = kindOf(m), [now, before] = total(m), vs = valuesOf(d), r = rnd(m, d, days), ratio = METRICS[m]![1] === 'ratio';
    if (DIMS[d]!.curve) {
      const at = (t: number, w: number, wobble: number) => (ratio ? fit(m, w === 1 ? 1 : Math.min(1, w * wobble)) : fit(m, t * (Math.abs(w) === 1 ? w : w * wobble)));
      return [vs.map(([, w]) => at(now, w, 1)), vs.map(([, w]) => at(before, w, 0.88 + 0.2 * r()))];
    }
    if (k === 'mean') return [vs.map(() => rate(m, now * (0.55 + 0.9 * r()))), vs.map(() => rate(m, before * (0.55 + 0.9 * r())))];
    return [apportion(now, vs.map(([, w]) => w * (0.8 + 0.4 * r()))), apportion(before, vs.map(([, w]) => w * (0.8 + 0.4 * r())))];
  }
  /** One row per value of a dimension, in its own order, before any sort or limit. */
  function rowsBy(d: string, alone: boolean): Row[] {
    const def = DIMS[d]!, time = def.type === 'time', vs = time ? [] : valuesOf(d), n = time ? days : vs.length, tag = TAGS[d];
    const rows = Array.from({ length: n }, (_, i): Row => (time ? { 'date.day': new Date(TODAY - (days - 1 - i) * DAY).toISOString().slice(0, 10), partial: i === days - 1 }
      : def.type === 'number' ? { [d]: Number(vs[i]![0]), [d + '@end']: Number(vs[i]![0]) + def.width! } : { [d]: vs[i]![0], ...(tag && { [tag[0]]: tag[1](vs[i]![1]) }) }));
    for (const m of metrics) {
      const [now, before] = time ? daily(m) : across(m, d);
      let run = 0;
      rows.forEach((r, i) => {
        r[m] = now[i]!; if (wantPrev) r[m + '@previous'] = hasPrev ? before[i]! : null;
        if (alone && RUNNING.includes(m)) { r[m + '@before'] = run; run += now[i]!; r[m + '@running'] = run; }
      });
    }
    return rows;
  }
  if (dims.includes('date.day')) meta.notes.push('Today is still in progress.');
  if (!dims.length) return { rows: [], totals, meta };
  const m0 = metrics[0]!, free = (d: string) => !DIMS[d]!.type && !DIMS[d]!.ordered && !DIMS[d]!.curve;
  // A dimension with no order of its own is ranked by the first metric, and `limit` keeps its first values.
  const top = (rs: Row[], d: string) => { if (!free(d)) return rs; const ranked = rs.slice().sort((a, b) => (b[m0] as number) - (a[m0] as number)); return q.limit ? ranked.slice(0, q.limit) : ranked; };
  if (dims.length === 1) {
    const d = dims[0]!, rows = top(rowsBy(d, true), d);
    // ponytail: a rank comes only with a query that compares, as the fixtures' does. A query has no way to ask for a companion.
    if (wantPrev && free(d)) rows.forEach((r, i) => { r[m0 + '@rank'] = i + 1; });
    return { rows, totals, meta };
  }

  // Two dimensions: one row per pair. A count in the outer row is divided among the inner one's values, unevenly from
  // one row to the next; a rate or a time wanders about the outer row's. Time, when it is there, is the outer one.
  const [outer, inner] = dims[1] === 'date.day' ? [dims[1], dims[0]!] : [dims[0]!, dims[1]!];
  const fields = metrics.flatMap((m) => (wantPrev ? [m, m + '@previous'] : [m])), inners = valuesOf(inner), outerRows = rowsBy(outer, false), r = rnd(outer, inner, days);
  const pairs = outerRows.flatMap((o, i) => {
    const weights = inners.map(([, w]) => Math.abs(w) * (0.8 + 0.4 * r()));
    const parts = fields.map((f) => { const m = f.split('@')[0]!; return o[f] == null ? null : kindOf(m) === 'mean' ? inners.map(() => rate(m, (o[f] as number) * (0.7 + 0.6 * r()))) : apportion(o[f] as number, weights); });
    return inners.map(([name, w], j): Row => {
      const row: Row = { ...o, [inner]: DIMS[inner]!.type === 'number' ? Number(name) : name, ...Object.fromEntries(fields.map((f, k) => [f, parts[k] ? parts[k]![j]! : null])) };
      // Who joined in a week and is still here so many weeks on: all of them at first, fewer each week, and nothing yet for the weeks that have not come.
      if (outer === 'cohort' && inner === 'weeks_since') for (const f of fields) if (f.startsWith('retention')) row[f] = j > outerRows.length - 1 - i ? null : j ? rate('retention', w * (0.85 + 0.3 * r())) : 1;
      return row;
    });
  });
  const alone = rowsBy(inner, false);
  const innerRows = inners.map(([name], j) => {
    const row: Row = { [inner]: alone[j]![inner] }, mine = pairs.filter((p) => String(p[inner]) === name);
    for (const f of fields) row[f] = kindOf(f.split('@')[0]!) === 'mean' ? alone[j]![f] : mine.some((p) => p[f] != null) ? sum(mine.map((p) => (p[f] as number) || 0)) : null;
    return row;
  });
  const totalsBy = { [outer]: top(outerRows, outer), [inner]: top(innerRows, inner) }, within = totalsBy[inner]!.map((x) => x[inner]);
  return { rows: totalsBy[outer]!.flatMap((o) => pairs.filter((p) => p[outer] === o[outer] && within.includes(p[inner]))), totals, totalsBy, meta };
}
