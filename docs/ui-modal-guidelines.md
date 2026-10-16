# UI Modal Guidelines

Use these rules for every modal popup in this project.

## Header Actions

- Place the primary submit action and the `Cancel` action in the modal header, aligned to the top-right side.
- Place the modal validation/error placeholder in the header as well, directly below the title/actions row so users see it immediately.
- Do not place confirm or cancel actions in the modal footer.
- Do not render a standalone close icon button in the header.
- Users must close the modal through the `Cancel` action instead of an `X` button.

## Behavior

- `Cancel` must always be a visible secondary action and must close the modal without saving.
- The primary action must remain a submit button for the modal form, even when it is visually placed in the header.
- Validation and save errors must render inside the modal header, not behind the overlay on the page content and not lower in the form body.

## Apply To New Modals

- Follow this pattern for all future create, edit, assign, and confirmation popups.
- If a modal is introduced in another screen, reuse this interaction pattern unless the product owner explicitly approves an exception.
