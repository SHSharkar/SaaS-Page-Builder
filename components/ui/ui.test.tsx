import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AppLink,
  Badge,
  Button,
  DataTable,
  DatePicker,
  Fieldset,
  Form,
  FormSelect,
  Input,
  Label,
  LiveRegion,
  ModalDialog,
  SearchableSelect,
  Stack,
  Surface,
  TabsPanel,
  Text,
  Textarea,
  TimePicker,
} from "./index";

describe("ui primitives", () => {
  it("renders accessible form, dialog, tabs, links, and surface primitives", () => {
    const labelText = "Workspace name";
    const submitText = "Save changes";
    const statusText = "Ready";
    const onSelectChange = vi.fn();

    render(
      <Surface>
        <Stack align="center" direction="row" gap="lg">
          <Text as="h2" tone="secondary" variant="heading">
            {labelText}
          </Text>
          <Badge tone="accent">{statusText}</Badge>
          <Badge tone="neutral">{statusText}</Badge>
          <LiveRegion assertive>{statusText}</LiveRegion>
          <AppLink href="/docs" variant="button">
            {statusText}
          </AppLink>
          <Form>
            <Fieldset legend={labelText}>
              <Label htmlFor="ws-name">{labelText}</Label>
              <Input defaultValue="Acme" id="ws-name" name="name" />
              <Textarea defaultValue="Notes" name="notes" />
              <DatePicker defaultValue="2026-10-24" name="launchDate" />
              <TimePicker defaultValue="09:30" name="launchTime" />
              <FormSelect
                name="locale"
                onChange={onSelectChange}
                options={[
                  { label: "English (UK)", value: "en-GB" },
                  { label: "English (US)", value: "en-US" },
                ]}
                value="en-GB"
              />
              <SearchableSelect
                filterPlaceholder="Filter locales"
                name="fallbackLocale"
                options={[
                  { label: "English (UK)", value: "en-GB" },
                  { label: "English (US)", value: "en-US" },
                ]}
              />
            </Fieldset>
            <Button type="submit" variant="secondary">
              {submitText}
            </Button>
          </Form>
          <ModalDialog
            closeLabel="Close"
            description="Confirm workspace details"
            title="Workspace confirmation"
            triggerLabel="Open modal"
          >
            <Text>{statusText}</Text>
          </ModalDialog>
          <TabsPanel
            defaultValue="tab-a"
            tabs={[
              {
                content: <Text>{statusText}</Text>,
                label: "Tab A",
                value: "tab-a",
              },
              {
                content: <Text>{labelText}</Text>,
                label: "Tab B",
                value: "tab-b",
              },
            ]}
          />
        </Stack>
      </Surface>,
    );

    const searchInput = screen.getByLabelText("Filter locales");
    fireEvent.change(searchInput, { target: { value: "US" } });

    expect(screen.getByRole("heading", { name: labelText })).toBeDefined();
    expect(screen.getByRole("button", { name: submitText })).toBeDefined();
    expect(screen.getByRole("button", { name: "Open modal" })).toBeDefined();
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("renders data table empty and populated states cleanly", () => {
    const emptyText = "No records";
    const emptyView = render(
      <DataTable<{ id: string; name: string }>
        columns={[{ accessorKey: "name", header: "Name" }]}
        data={[]}
        emptyLabel={emptyText}
      />,
    );
    expect(emptyView.getByText(emptyText)).toBeDefined();
    emptyView.unmount();

    render(
      <DataTable<{ id: string; name: string }>
        caption="Sites list"
        columns={[
          { accessorKey: "name", header: "Name" },
          {
            accessorKey: "id",
            cell: (row) => row.id.toUpperCase(),
            header: "Identifier",
          },
        ]}
        data={[{ id: "s1", name: "Acme Site" }]}
        emptyLabel={emptyText}
        rowKey={(row) => row.id}
      />,
    );
    expect(screen.getByText("Acme Site")).toBeDefined();
    expect(screen.getByText("S1")).toBeDefined();
  });
});
