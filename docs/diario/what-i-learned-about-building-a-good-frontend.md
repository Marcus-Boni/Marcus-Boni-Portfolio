Imagine you need to close the books for the month. You open the reports
screen, pick November and click **Export CSV**. The button goes gray.
Do you wait, click again or check your downloads folder?

That scene gets at the question I wanted to explore after writing about
[my front-end toolbox](/blog/caixa-de-ferramentas-front-end). Once the
interface is built, how can I tell whether it helps someone do what they
came to do? I looked at how product teams document those decisions and
what guides for coding agents ask them to check. I used the reports screen
to see how the advice holds up against a concrete design problem.

:::takeaways
- I want to understand the task before deciding what goes on the screen.
- Proximity, visual weight and spacing help people read the interface in the right order.
- Loading, errors and recovery each need copy, behavior and a test.
- Before shipping, I would run the flow on a phone, with a keyboard and with a deliberate failure.
:::

## The first test is finding the way through

If the request is “add an export button,” my first question is who needs
the file and what they’ll do with it. “Download November’s transactions
so I can close the books” already gives me something to test. Can the
person confirm which records the CSV will include? Do they need to tell
transaction dates apart from payment dates? The answers might change
the filter, the wording and the contents of the file itself.

I’d start with support tickets and a conversation with someone who
closes the books. With a simple prototype, I’d ask them to download
November’s transactions for the close and watch where they start, where
they hesitate and whether they finish. The instruction only needs to
describe the goal. Finding the control is part of the test. I’d repeat
it with people who use a keyboard or a screen reader to navigate.
[Learning about users and their needs at GOV.UK](https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs) · [Moderated usability testing at GOV.UK](https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing)

This also changes how I’d organize the navigation. If people use the
period filter every week, I’d keep it within easy reach. If they need to
compare two dates, I’d keep both available together. When someone opens
a transaction to check a detail, I’d also check that they can get back to
the list with their period and filters intact.
[Jakob Nielsen’s usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) · [Progressive disclosure at Nielsen Norman Group](https://www.nngroup.com/articles/progressive-disclosure/)

## What needs to stand out first

I’d build the screen with realistic data. **Financial report** tells me
where I am. **November 2026** gives me the time frame. **48 entries** helps
me confirm what will end up in the file. From there, I can decide what
deserves more visual weight. If a label seems closer to the wrong piece
of information, adjusting the spacing between groups might fix it before
I touch the color or type size.
[Refactoring UI by Adam Wathan and Steve Schoger](https://refactoringui.com/) · [Visual hierarchy at Nielsen Norman Group](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/)

One thing I liked about IBM Carbon is that the same system makes room for
more compact typography on working screens and more expressive typography
in places like marketing pages. That gives me a way to think about density.
In a table, I want to compare two rows easily. On a product page, I can
give the text more breathing room and let the type carry some personality.
In both cases, I’d give the title, body and labels distinct roles, preserve
the heading structure in HTML and test with long text.
[IBM Carbon typography](https://www.carbondesignsystem.com/building-blocks/foundations/typography/overview) · [IBM Carbon spacing](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview)

One idea I took from the skills was to base the visual direction on the
subject and the actual content. If I were comparing two page designs, I’d
give them the same offer and the same action so I could see which
composition communicates better. A short placeholder headline can fit
almost anywhere. A real headline is already a layout test.
[Anthropic’s Frontend Design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) · [Huashu Design](https://github.com/alchaincyf/huashu-design/tree/59065698ad63f87ea1532c126c87f488d4f93fd6)

## The gray button is only one state

I’d keep **Export CSV** as the label because it tells the person what
will happen. While they wait, I’d show **Generating report** next to the
action. I’d also check what happens when there are no entries yet, when
a filter returns nothing or when the person needs permission. Each case
needs a message and a way forward.

:::report-comparison
Before, the export button becomes unavailable and the screen gives no feedback. After, you can confirm the period, see that the file is ready and download the CSV.
:::

| What happened | What I’d show |
| --- | --- |
| The period has entries | The number of results and the export action. |
| The filter returned nothing | “No entries in November” and a way to change the period. |
| The file is being generated | A status near the action, announced to screen readers. |
| The file is ready | A **Download CSV** link. |
| Export failed | A message about the failure and a way to retry with the same filters. |

If I can measure progress, I’d show it. A skeleton can help for a slow
list whose structure I already know. For a CSV export, I’d start with
an indicator near the button. If the file becomes ready while the person
is elsewhere on the page, I’d announce the change and keep their focus
where it is.
[Empty states in IBM Carbon](https://www.carbondesignsystem.com/building-blocks/core/patterns/empty-states) · [Loading in IBM Carbon](https://www.carbondesignsystem.com/building-blocks/core/patterns/loading) · [WCAG status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

I like one detail in GOV.UK’s forms. Errors appear next to the fields and
in a summary at the top. The summary receives focus and links back to each
field. On the reports screen, “Choose an end date on or after the start
date” gives the reader something they can do. I’d keep the dates they
typed so they only need to fix one of them. Before that, I’d remove any
question the service can already answer with the data it has.
[GOV.UK error summary](https://design-system.service.gov.uk/components/error-summary/) · [GOV.UK question pages](https://design-system.service.gov.uk/patterns/question-pages/) · [WAI form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/)

## The same task with a keyboard and on a phone

My review changes when I put the mouse aside. I want to see where focus is,
activate **Export CSV** and find **Download CSV**. If there’s a dialog,
I check where focus goes when it opens, whether Escape closes it and where
focus returns. Starting with native controls helps preserve those behaviors.
The button creates the file, the link leads to the download and each field
has an associated label.
[W3C ARIA practices](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/) · [Modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

On a phone, I’d let the content tell me when the grid needs to change.
The filters can stack as soon as they start competing for space. If
comparing columns is essential, I’d keep horizontal scrolling inside
the table and fit the rest of the page to the screen. I’d run the same
review with zoom, long text and the themes the product offers.
[Responsive design at web.dev](https://web.dev/articles/responsive-web-design-basics) · [WCAG reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

WCAG 2.2 AA gives me numbers for part of that review. Regular text needs
at least **4.5∶1** contrast and large text needs **3∶1**. A **3∶1**
criterion also applies to certain visual cues in controls, states and
graphics. AA pointer targets start at **24 × 24 CSS px**, with exceptions
such as adequate spacing. The enhanced AAA criterion uses **44 × 44 CSS
px**, also with exceptions. For most content, the reflow reference is
**320 CSS px** wide without scrolling in both directions. I’d use these
criteria alongside testing the complete flow with keyboard, touch and a
screen reader.
[WCAG 2.2](https://www.w3.org/TR/WCAG22/) · [Text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [Non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) · [Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

## How often will someone see this animation?

One question from Emil Kowalski stuck with me. How many times will someone
see this animation? You can enjoy the first time a panel opens and be
tired of it by the tenth. For a frequently changed filter, I’d try an
immediate response. A short transition can explain where a panel came from
when it opens over the table. With `prefers-reduced-motion`, I’d keep the
text and state visible and reduce the movement. If the effect runs poorly,
I’d start by looking at what changes on each frame.
[Emil Kowalski on frequency of use](https://emilkowal.ski/ui/you-dont-need-animations) · [Motion in Apple’s HIG](https://developer.apple.com/design/human-interface-guidelines/motion) · [High-performance animations at web.dev](https://web.dev/articles/animations-guide)

## Where the time goes

I’d measure the initial page load, changing the period and clicking export.
Each step can have its own bottleneck. If the screen jumps when content
arrives, I’d check whether images and other late content have space set
aside. If the main content takes too long, I’d find out when its resource
is discovered and what competes with it. If the filter feels slow, I’d look
for independent requests waiting on one another and heavy work on the main
thread.
[Optimizing LCP](https://web.dev/articles/optimize-lcp) · [Optimizing CLS](https://web.dev/articles/optimize-cls) · [Optimizing INP](https://web.dev/articles/optimize-inp) · [Vercel’s React Best Practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)

In production, I use Google’s Core Web Vitals as reference points.
**LCP of 2.5 s or less** for the main content to appear, **INP of 200 ms
or less** for the visual response to interactions and **CLS of 0.1 or
less** for unexpected shifts. The thresholds apply at the 75th percentile,
with mobile and desktop evaluated separately. When field data is available,
I use it to find the route or interaction that needs attention. Lab tests
help reproduce the issue under known conditions.
[Core Web Vitals](https://web.dev/articles/vitals)

## What I’d write down for the next screen

The GitHub Actions team adapted navigation already used in settings and
used Primer to support different viewport widths. They also grouped runs
of reusable workflows and added a way back to the list. That’s the kind
of reuse I’d look for in my own project. The foundation is already there,
and the new task tells me what to change.
[GitHub Actions navigation redesign](https://github.blog/news-insights/product-news/improving-navigation-for-github-actions/)

If the pattern will show up again, I want to record the decision behind
it. A token like `text-muted` keeps its role even when its color changes
in dark mode. An export component also needs to make it clear how it
communicates progress, success and failure. In React, I’d represent
those states explicitly to keep “file ready” and “generating” from
appearing together. In the test, I’d find the action using the same name
the person sees and follow the path through download and error recovery.
[Atlassian design tokens](https://atlassian.design/foundations/tokens/) · [React state structure](https://react.dev/learn/choosing-the-state-structure) · [Playwright best practices](https://playwright.dev/docs/best-practices)

With a coding agent, I’d put what I want to verify right in the request.
For this screen, that might be “if export fails, keep the period, explain
what happened and let me retry with the keyboard.” Then I can open the
browser, trigger the failure and see whether the interface does what we
agreed on. That was one of the most practical ideas I took from the review
skills.
[Frontend UI Engineering by Addy Osmani](https://skills.addy.ie/skills/frontend-ui-engineering/) · [Better Interface by Jakub Krehel](https://github.com/jakubkrehel/skills/tree/672ae44ace6aaed65b86cbb1e2fd6fbea0e79578)

## The review I’d do before shipping

1. Ask someone to do the task and watch where they pause or ask for help.
2. Open the screen on a phone and check whether the real content follows the order in which I need to make decisions.
3. Run through it with a keyboard and check focus and announcements with a screen reader.
4. Simulate a slow connection, an empty result and a failure. Check whether I can pick up the task again.
5. Record the decisions that will come up again and the test that helps protect them.

If I only have time for one pass, I do the main task with a keyboard,
trigger a failure and try to recover. That’s how I’d come back to the
screen from the beginning. I’d call the export done when it’s clear
what happened to the file and what I can do next.
