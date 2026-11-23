# The vision

`<ua-view>` is one component for showing data wherever data needs showing.

An author, human or agent, says what the data is and how it maps to marks. That is all a view is told. It is built from primitive shapes that combine harmoniously, not picked from a list of chart types, so a diagram nobody planned for is as easy to write as a bar chart.

Everything else belongs to where the view lands. Its size, theme and visual design come from the container, so the same view is right in a dashboard, a sentence, a widget or an overlay without being told which it is in.

The browser is its first home, not its only one. What a view is, and how it gives way when room is short, are described as data that any surface can read. Nothing in its core knows what a browser is.

It is light: no framework, and few dependencies.

It aims to do most things exceptionally well, but not everything. A valid view always draws something meaningful, and can say why it looks the way it does. What it cannot say comfortably is a reason to extend it with a custom mark or to use another tool, not a reason to bend the grammar.