import type { Layer, Query, Spec } from '@universal-analytics/core';

/* The goals page, as data: the seventeen goals a plan can have, the metrics each one's dashboard shows, and for every
 * metric the views that show it. A view here is a spec and nothing more. Whatever a spec could not say is written
 * beside it as a `gap`, which the page sets under the view. */
const RANGE = '28d';
const Q = (metrics: string[], by?: string[], more: Partial<Query> = {}): Query => ({ metrics, ...(by && { by }), range: RANGE, ...more });
const view = (title: string, query: Query, rest: Partial<Spec>): Spec => ({ spec: 'view/0', title, query, ...rest });
const preset = (use: string, title: string, metrics: string[], by: string[], more: Partial<Query> = {}) => view(title, Q(metrics, by, more), { use });
/** A metric day by day, against the period before. */
const line = (title: string, metric: string) => preset('line', title, [metric], ['date.day'], { compare: 'previous' });
/** The same, painted by which way it went: for a metric where a rise is the bad news. */
const watch = (title: string, metric: string): Spec => {
  const encode = { x: 'date.day', y: metric };
  return view(title, Q([metric], ['date.day'], { compare: 'previous' }), { layers: [{ mark: 'area', encode, role: 'context', paint: 'delta' }, { mark: 'line', encode, series: 'previous', role: 'comparison' }, { mark: 'line', encode, paint: 'delta' }] });
};
/** A level, where what matters is how it moved and not how far it stands from nothing: the lines with no fill under them. */
const level = (title: string, metric: string): Spec => view(title, Q([metric], ['date.day'], { compare: 'previous' }), { layers: [{ mark: 'line', encode: { x: 'date.day', y: metric }, series: 'previous', role: 'comparison' }, { mark: 'line', encode: { x: 'date.day', y: metric } }] });
const list = (title: string, metric: string, by: string, limit = 8) => preset('bar-list', title, [metric], [by], { limit });
const share = (title: string, metric: string, by: string) => preset('share-bar', title, [metric], [by]);
/** Rows with a column for each metric, and a bar for the first. */
const columns = (title: string, metrics: string[], by: string, limit = 8): Spec => view(title, Q(metrics, [by], { limit }), { layers: [
  { mark: 'bar', encode: { y: by, x: metrics[0]! } }, { mark: 'text', encode: { y: by, text: by } }, ...metrics.map((m): Layer => ({ mark: 'text', encode: { y: by, text: m }, align: 'end' }))] });
/** Rows with each one's change on the period before. */
const changes = (title: string, metric: string, by: string, limit = 8): Spec => view(title, Q([metric], [by], { limit, compare: 'previous' }), { layers: [
  { mark: 'bar', encode: { y: by, x: metric } }, { mark: 'text', encode: { y: by, text: by } }, { mark: 'text', encode: { y: by, text: metric }, align: 'end' }, { mark: 'text', encode: { y: by, text: metric }, series: 'delta', align: 'end' }] });
/** Several metrics of one unit, a line each. */
const lines = (title: string, metrics: string[]): Spec => view(title, Q(metrics, ['date.day']), { layers: metrics.map((m, i): Layer => ({ mark: 'line', encode: { x: 'date.day', y: m }, ...(i && { paint: 'series.' + (i + 1) }) })) });

export interface Card { spec: Spec; /** Twice the width of a card. */ wide?: boolean; /** What the spec could not say, and what is drawn in its place. */ gap?: string }
export interface Metric { /** In the catalog, and not built yet. */ later?: boolean; /** The catalog metric whose number heads the dashboard. */ tile?: string; cards: Card[] }
const c = (spec: Spec, more: Omit<Card, 'spec'> = {}): Card => ({ spec, ...more });

export const METRICS: Record<string, Metric> = {
  'Revenue by channel and page': { tile: 'revenue', cards: [
    c(line('Revenue', 'revenue'), { wide: true }), c(list('Revenue by channel', 'revenue', 'channel')), c(list('Revenue by page', 'revenue', 'page')),
    c(preset('heatmap', 'Revenue by page and channel', ['revenue'], ['page', 'channel'], { limit: 6 }), { wide: true })] },
  'Conversions': { tile: 'conversions', cards: [
    c(line('Conversions', 'conversions'), { wide: true }), c(columns('Conversions by event', ['conversions', 'conversion_rate', 'conversion_value'], 'event'), { wide: true })] },
  'Channels': { cards: [c(share('Channels', 'visitors', 'channel')), c(columns('What each channel brings', ['visitors', 'conversions', 'conversion_rate'], 'channel'), { wide: true })] },
  'Visitors': { tile: 'visitors', cards: [c(line('Visitors', 'visitors'), { wide: true })] },
  'Page views': { tile: 'pageviews', cards: [c(line('Page views', 'pageviews'), { wide: true })] },
  'Engaged time': { tile: 'engaged_time', cards: [c(line('Engaged time', 'engaged_time'), { wide: true }), c(list('Engaged time by page', 'engaged_time', 'page'))] },
  'Top pages': { cards: [c(list('Top pages', 'pageviews', 'page'))] },
  'Referrers': { cards: [c(list('Referrers', 'visitors', 'referrer'))] },
  'Campaigns': { cards: [c(columns('Campaigns', ['visitors', 'conversions', 'conversion_rate'], 'campaign'), { wide: true })] },
  'Calls, emails and directions': { cards: [c(list('Calls, emails and directions', 'conversions', 'contact_action')), c(preset('stacked-bar', 'Day by day', ['conversions'], ['date.day', 'contact_action']), { wide: true })] },
  'Locations': { cards: [c(view('Where visitors are', Q(['visitors'], ['country']), { layers: [{ mark: 'geo', encode: { x: 'country', color: 'visitors' } }] }), { wide: true }), c(list('Countries', 'visitors', 'country', 6)),
    c(list('Towns', 'visitors', 'city'), { gap: 'The map is handed country shapes, and a business that wants people through its door asks which towns. That takes shapes or points the geo mark is not given here, so the towns are a list.' })] },
  'Device, browser, OS': { cards: [c(preset('donut', 'Devices', ['visitors'], ['device'])), c(share('Browsers', 'visitors', 'browser')), c(share('Operating systems', 'visitors', 'os'))] },
  'What changed': { cards: [c(preset('dumbbell', 'Pages, then and now', ['pageviews'], ['page'], { compare: 'previous', limit: 6 })), c(changes('Channels, and their change', 'visitors', 'channel'))],  },
  'AI assistants as a channel': { tile: 'ai_visitors', cards: [c(line('Visitors from AI assistants', 'ai_visitors'), { wide: true }), c(list('Which assistant', 'ai_visitors', 'assistant')), c(list('Pages they land on', 'ai_visitors', 'landing_page', 5))] },
  'Present now': { tile: 'present', cards: [c(view('Present now', { metrics: ['present'], by: ['page'] }, { use: 'bar-list' }))] },
  'Who viewed it': { tile: 'viewers', cards: [c(view('Who viewed it', Q(['views', 'engaged_time', 'read_through'], ['viewer']), { layers: [
    { mark: 'bar', encode: { y: 'viewer', x: 'views', color: 'viewer@heat' } }, { mark: 'text', encode: { y: 'viewer', text: 'viewer' } }, { mark: 'text', encode: { y: 'viewer', text: 'views' }, align: 'end' },
    { mark: 'text', encode: { y: 'viewer', text: 'engaged_time' }, align: 'end' }, { mark: 'text', encode: { y: 'viewer', text: 'read_through' }, align: 'end' }] }), { wide: true, gap: 'The rows are painted by each viewer\'s interest, a companion the engine returns, and nothing says which colour is which: rows have no legend. When each last opened it would be a column too, and a column that is not a metric is written raw, so a date is left out.' })] },

  'Orders': { later: true, tile: 'orders', cards: [c(view('Orders and revenue', Q(['orders', 'revenue'], ['date.day']), { layers: [{ mark: 'bar', encode: { x: 'date.day', y: 'orders' } }, { mark: 'line', encode: { x: 'date.day', y: 'revenue' }, paint: 'series.2' }] }), { wide: true })] },
  'Funnels': { later: true, cards: [c(preset('funnel', 'Funnel', ['visitors', 'conversion_rate'], ['step']), { wide: true })] },
  'Top products': { later: true, cards: [c(columns('Top products', ['revenue', 'orders'], 'product', 7), { wide: true })] },
  'Customers': { later: true, tile: 'customers', cards: [c(share('New and returning customers', 'customers', 'customer_type')), c(preset('stacked-bar', 'Customers by day', ['customers'], ['date.day', 'customer_type']), { wide: true })] },
  'Conversion credit': { later: true, cards: [c(preset('grouped-bar', 'Credit for conversions, by channel', ['conversions'], ['channel', 'credit_model'], { limit: 5 }), { wide: true })] },
  'Coupons': { later: true, cards: [c(columns('Coupons', ['orders', 'discounts', 'revenue'], 'coupon'), { wide: true })] },
  'Revenue breakdown': { later: true, cards: [c(preset('waterfall', 'From gross sales to net revenue', ['amount'], ['revenue_part']), { wide: true, gap: 'A waterfall ends with a bar for what is left, standing on zero. Every bar here runs from the running total before it, so the last one is the last change. The engine would have to send the net as a row of its own.' })] },
  'Subscribers': { later: true, tile: 'subscribers', cards: [c(level('Subscribers', 'subscribers'), { wide: true, gap: 'A level is read by how it moved, and the plot\'s scale holds zero whatever the mark, so a month\'s change is a few pixels. A spec has no way to say the scale may leave zero. Drawn as lines with no fill, which is the most a spec can do.' }), c(preset('waterfall', 'Joined less left, day on day', ['net_subscribers'], ['date.day'])), c(list('New subscribers came from', 'new_subscribers', 'channel'))] },
  'Email opens and clicks': { later: true, cards: [c(columns('Emails', ['delivered', 'open_rate', 'click_rate'], 'email'), { wide: true }),
    c(view('Opened against clicked', Q(['open_rate', 'click_rate'], ['email']), { layers: [{ mark: 'dot', encode: { x: 'open_rate', y: 'click_rate' } }, { mark: 'text', encode: { x: 'open_rate', y: 'click_rate', text: 'email' } }] }), { wide: true })] },
  'Retention': { later: true, tile: 'retention', cards: [c(preset('heatmap', 'Who is still here, by the week they joined', ['retention'], ['cohort', 'weeks_since']), { wide: true }),
    c(view('Still here, week by week', Q(['retention'], ['weeks_since']), { layers: [{ mark: 'area', encode: { x: 'weeks_since', y: 'retention' }, role: 'context' }, { mark: 'line', encode: { x: 'weeks_since', y: 'retention' } }] }))] },
  'Recurring revenue': { later: true, tile: 'mrr', cards: [c(level('Recurring revenue', 'mrr'), { wide: true, gap: 'A level is read by how it moved, and the plot\'s scale holds zero whatever the mark, so a month\'s change is a few pixels. A spec has no way to say the scale may leave zero. Drawn as lines with no fill, which is the most a spec can do.' }), c(preset('donut', 'By plan', ['mrr'], ['plan']))] },
  'New vs returning': { later: true, cards: [c(share('New and returning', 'visitors', 'visitor_type')), c(preset('stacked-area', 'New and returning, by day', ['visitors'], ['date.day', 'visitor_type']), { wide: true })] },
  'Landing pages': { later: true, cards: [c(columns('Landing pages', ['visitors', 'conversion_rate', 'engaged_time'], 'landing_page', 6), { wide: true })] },
  'Social shares': { later: true, tile: 'shares', cards: [c(list('Shared to', 'shares', 'network')), c(list('Most shared', 'shares', 'page', 5))] },
  'Recirculation': { later: true, tile: 'recirculation', cards: [c(line('Went on to another page', 'recirculation'), { wide: true }), c(list('By page', 'recirculation', 'page', 6))] },
  'Scroll depth': { later: true, cards: [c(view('How far people read', Q(['reached'], ['depth'], { compare: 'previous' }), { layers: [
    { mark: 'area', encode: { x: 'depth', y: 'reached' }, role: 'context' }, { mark: 'line', encode: { x: 'depth', y: 'reached' }, series: 'previous', role: 'comparison' }, { mark: 'line', encode: { x: 'depth', y: 'reached' } }] }))] },
  'Sections and tags': { later: true, cards: [c(list('Sections', 'pageviews', 'site_section')), c(list('Tags', 'pageviews', 'tag'))] },
  'Authors': { later: true, cards: [c(columns('Authors', ['pageviews', 'visitors', 'engaged_time'], 'author'), { wide: true })] },
  'Ad earnings': { later: true, tile: 'ad_revenue', cards: [
    c(view('Page views and ad earnings', Q(['pageviews', 'ad_revenue'], ['date.day']), { layers: [{ mark: 'bar', encode: { x: 'date.day', y: 'pageviews' } }, { mark: 'line', encode: { x: 'date.day', y: 'ad_revenue' }, paint: 'series.2' }] }), { wide: true }),
    c(list('Earnings by section', 'ad_revenue', 'site_section'))] },
  'Outbound clicks': { later: true, tile: 'outbound_clicks', cards: [c(line('Outbound clicks', 'outbound_clicks'), { wide: true }), c(list('Where they went', 'outbound_clicks', 'destination')), c(list('From which page', 'outbound_clicks', 'page', 5))] },
  'Responses by option': { later: true, tile: 'responses', cards: [c(share('Responses', 'responses', 'option')), c(preset('stacked-bar', 'Responses by day', ['responses'], ['date.day', 'option']), { wide: true })] },
  'Custom metrics': { later: true, tile: 'custom', cards: [c(view('Saved for later, against 50 a day', Q(['custom'], ['date.day']), { layers: [{ mark: 'bar', encode: { x: 'date.day', y: 'custom' } }, { mark: 'rule', encode: { y: 50 }, label: 'Target 50', role: 'reference' }] }), { wide: true })] },
  'Popular times': { later: true, cards: [c(preset('heatmap', 'Popular times', ['visitors'], ['weekday', 'hour']), { wide: true })] },
  'Bookings': { later: true, tile: 'bookings', cards: [c(preset('gauge', 'Bookings against the month\'s target', ['bookings'], [])), c(columns('By service', ['bookings', 'revenue'], 'service')), c(preset('stacked-bar', 'Bookings by day', ['bookings'], ['date.day', 'service']), { wide: true })] },
  'Read-through': { later: true, tile: 'read_through', cards: [c(preset('gauge', 'Read to the end', ['read_through'], [])), c(list('By page', 'read_through', 'page', 6))] },
  'Search terms': { later: true, cards: [c(columns('Search terms', ['search_clicks', 'search_ctr'], 'search_term'), { wide: true })] },
  'On-site searches': { later: true, tile: 'searches', cards: [c(line('On-site searches', 'searches'), { wide: true }), c(columns('What people searched for', ['searches', 'no_result_rate'], 'site_search'), { wide: true })] },
  '404s': { later: true, tile: 'not_found', cards: [c(watch('404s', 'not_found'), { wide: true }), c(list('Pages not found', 'not_found', 'missing_url'))] },
  'Was this helpful': { later: true, tile: 'helpful_rate', cards: [c(preset('gauge', 'Said it helped', ['helpful_rate'], [])), c(share('Votes', 'helpful_votes', 'helpful_answer')), c(list('By page', 'helpful_rate', 'page', 6))] },
  'Organizations visiting': { later: true, cards: [c(columns('Organizations visiting', ['visitors', 'pageviews', 'engaged_time'], 'organization'), { wide: true })] },
  'Active users': { later: true, tile: 'dau', cards: [c(lines('Active users', ['mau', 'wau', 'dau']), { wide: true, gap: 'Three metrics on one plot, and nothing says which line is which: a legend comes from a dimension on color, and these are three metrics. Each layer is given its paint by hand. The readout names them, one at a time.' })] },
  'Feature usage': { later: true, cards: [c(columns('Feature usage', ['uses', 'adoption'], 'feature'), { wide: true })] },
  'Script errors': { later: true, tile: 'errors', cards: [c(watch('Script errors', 'errors'), { wide: true }), c(columns('Errors', ['errors', 'error_users'], 'error'), { wide: true }), c(preset('grouped-bar', 'By browser and version', ['errors'], ['browser', 'version'], { limit: 4 }))] },
  'Versions': { later: true, cards: [c(share('Versions in use', 'visitors', 'version')), c(view('Versions, by day', Q(['visitors'], ['date.day', 'version']), { layers: [{ mark: 'area', encode: { x: 'date.day', y: 'visitors', color: 'version' }, stack: 'normalize' }] }), { wide: true })] },
  'Visitor journeys': { later: true, cards: [c(list('Most common journeys', 'visitors', 'journey'), { wide: true, gap: 'A journey is a flow: people leaving one step and dividing among the next. That is a custom mark (a Sankey), which is not built. The engine names each whole path here and the rows rank them, so where two paths share a step cannot be seen.' })] },
  'Likes and comments': { later: true, tile: 'comments', cards: [c(lines('Likes and comments', ['likes', 'comments']), { wide: true, gap: 'Two metrics on one plot, and nothing says which line is which: a legend comes from a dimension on color, and these are two metrics.' }), c(columns('By topic', ['comments', 'likes'], 'page', 6))] },
  'Loyalty': { later: true, tile: 'returning_rate', cards: [c(view('How often people visit', Q(['visitors'], ['visits']), { layers: [{ mark: 'bar', encode: { x: 'visits', y: 'visitors' } }] })), c(line('Came back', 'returning_rate'), { wide: true })] },
  'Not opened yet': { later: true, tile: 'opened_share', cards: [c(preset('gauge', 'Opened it', ['opened_share'], [])),
    c(list('Not opened yet', 'days_waiting', 'unopened'), { gap: 'This is a list of names with no measure, and a query needs a metric. The rows are drawn by the days since each was sent it, which the engine had to be asked for to have a list at all.' })] },
  'Attention by section': { later: true, cards: [c(list('Attention by section', 'engaged_time', 'section'))] },
  'New viewers from forwards': { later: true, tile: 'forward_viewers', cards: [c(list('Forwarded by', 'forward_viewers', 'forwarded_by'))] },
  'Cold, warm or hot': { later: true, cards: [c(share('Viewers by interest', 'viewers', 'heat')),
    c(view('Each viewer\'s interest', Q(['engaged_time'], ['viewer']), { layers: [{ mark: 'bar', encode: { y: 'viewer', x: 'engaged_time', color: 'viewer@heat' } }, { mark: 'text', encode: { y: 'viewer', text: 'viewer' } }, { mark: 'text', encode: { y: 'viewer', text: 'viewer@heat' }, align: 'end' }] }))] },
};

export interface Goal { id: string; name: string; success: string; kinds: string; headline: string[]; also: string[] }
const g = (id: string, name: string, success: string, kinds: string, headline: string[], also: string[]): Goal => ({ id, name, success, kinds, headline, also });
export const GOALS: Goal[] = [
  g('sell', 'Sell', 'Completed purchases, money in', 'Commerce, Outcomes', ['Revenue by channel and page', 'Orders', 'Conversions', 'Funnels'], ['Top products', 'Customers', 'Channels', 'Conversion credit', 'Coupons', 'Revenue breakdown']),
  g('paying_supporters', 'Get paying supporters', 'Paid subscriptions, memberships, renewals', 'Outcomes, Audience', ['Subscribers', 'Conversions', 'Revenue by channel and page'], ['Email opens and clicks', 'Conversion credit', 'Retention', 'Top pages', 'Recurring revenue']),
  g('grow_audience', 'Grow an audience', 'Email signups, follows, people who come back', 'Audience, Acquisition', ['Subscribers', 'Conversions', 'Visitors', 'Channels'], ['New vs returning', 'Referrers', 'Landing pages', 'Conversion credit', 'Email opens and clicks', 'Social shares']),
  g('earn_attention', 'Earn attention', 'Views, time spent, depth (often ad-supported)', 'Content, Audience', ['Visitors', 'Page views', 'Engaged time', 'Top pages'], ['Channels', 'Referrers', 'Recirculation', 'Scroll depth', 'Sections and tags', 'Authors', 'Ad earnings', 'What changed']),
  g('send_elsewhere', 'Send people elsewhere', 'Affiliate and outbound clicks that pay', 'Outcomes, Content', ['Outbound clicks', 'Conversions', 'Visitors'], ['Top pages', 'Channels', 'Responses by option', 'Custom metrics']),
  g('get_contacted', 'Get contacted', 'Form fills, calls, emails', 'Outcomes, Acquisition', ['Conversions', 'Funnels', 'Channels'], ['Landing pages', 'Conversion credit', 'Campaigns', 'Top pages', 'Calls, emails and directions']),
  g('get_booked', 'Get booked', 'Appointments, reservations, tickets', 'Outcomes, Commerce', ['Conversions', 'Revenue by channel and page', 'Funnels'], ['Channels', 'Popular times', 'Conversion credit', 'Bookings']),
  g('through_the_door', 'Get people through the door', 'Directions, calls, local visitors', 'Outcomes, Audience', ['Conversions', 'Locations', 'Visitors'], ['Device, browser, OS', 'Popular times', 'Top pages', 'Calls, emails and directions']),
  g('inform', 'Inform', 'Read to the end, understood, shared', 'Content, Audience', ['Visitors', 'Engaged time', 'Read-through', 'Top pages'], ['Scroll depth', 'Channels', 'Search terms', 'New vs returning', 'Recirculation', 'AI assistants as a channel']),
  g('self_help', 'Help people help themselves', 'Found the answer, didn\'t need support', 'Content, Outcomes', ['On-site searches', 'Top pages', 'Engaged time'], ['Search terms', '404s', 'Responses by option', 'AI assistants as a channel', 'Recirculation', 'Was this helpful']),
  g('build_trust', 'Build trust', 'The right people visit, look around, act elsewhere', 'Audience, Acquisition', ['Visitors', 'New vs returning', 'Top pages', 'Referrers'], ['Locations', 'Engaged time', 'Channels', 'Conversions', 'Organizations visiting']),
  g('recruit', 'Recruit', 'Job views and applications', 'Outcomes, Acquisition', ['Conversions', 'Funnels', 'Top pages'], ['Channels', 'Referrers', 'Campaigns', 'Locations']),
  g('cause_action', 'Drive action for a cause', 'Donations, signatures, volunteers', 'Outcomes, Commerce', ['Conversions', 'Revenue by channel and page', 'Channels'], ['Funnels', 'Social shares', 'Campaigns', 'Conversion credit', 'Subscribers']),
  g('get_used', 'Get used', 'Signups, first real use, repeat use', 'Product usage', ['Active users', 'Retention', 'Feature usage'], ['Funnels', 'Script errors', 'Versions', 'Device, browser, OS', 'Visitor journeys']),
  g('bring_together', 'Bring people together', 'Posts, replies, members who come back', 'Product usage, Content', ['Active users', 'Likes and comments', 'Loyalty'], ['Present now', 'Feature usage', 'Popular times', 'Retention']),
  g('reach_intended', 'Reach the intended people', 'The specific people it was made for opened it and got through it', 'Viewership', ['Who viewed it', 'Not opened yet', 'Read-through', 'Engaged time'], ['Present now', 'Device, browser, OS', 'Versions', 'New viewers from forwards']),
  g('get_decision', 'Get a decision', 'Feedback, approval, a yes', 'Viewership, Outcomes', ['Who viewed it', 'Read-through', 'Responses by option', 'Conversions'], ['Not opened yet', 'Engaged time', 'Feature usage', 'Present now', 'Attention by section', 'New viewers from forwards', 'Cold, warm or hot']),
];
