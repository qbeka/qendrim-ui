# Usability task script

No participants have used this library. Nothing here is a finding. This is the script to use once real people are available.

## Who to recruit

Five product engineers who have shipped a React app, and five people who use a project tool at work. Do not recruit people who worked on this project.

## Setup

Run `pnpm dev`, open `http://localhost:5171/examples/projects` and turn off Diagnostics. Say: "I am testing the software, not you. Please think out loud."

## Tasks

1. Change the budget of Harbor rebuild to 900000 and save it.
2. Change the budget of Field survey to "about 80k" and save. Then fix what the page asks you to fix.
3. Turn on Fail saves. Rename a project and save. Tell me what happened and what you would do next.
4. Open a project and start typing a name. Change your mind and close it. Change your mind again and finish typing.
5. Archive a project. Bring it back.
6. Open the receipt review. Approve two receipts at once. Undo that.
7. In one receipt, change who paid. Tell me how the balance changed.

For engineers only:

8. Install the tarball in an empty Vite app and put one Inspector on the page. Stop at 15 minutes.
9. Using only the docs, make a Save and close button that does not close if the user keeps typing.

## What to record

- Completed or not, with or without help.
- Time on task.
- Where the person hesitated, and what they said.
- Whether the person lost any work, or believed they had.
- For task 4: whether the person noticed anything at all. Not noticing is the goal.

## What this would not show

Five people find many problems and measure nothing precisely. Do not turn these sessions into percentages.
