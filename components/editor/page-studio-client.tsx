"use client";

import { useState, useTransition } from "react";
import {
  publishPageAction,
  saveDraftAction,
  schedulePageAction,
} from "@/app/server/pages/actions";
import { DocumentRenderer } from "@/components/blocks/document-renderer";
import {
  Badge,
  Button,
  DatePicker,
  Form,
  FormSelect,
  Input,
  Label,
  LiveRegion,
  Stack,
  Surface,
  TabsPanel,
  Text,
  Textarea,
  TimePicker,
} from "@/components/ui";
import { useTranslations } from "@/hooks/use-translations";
import type { BlockNode, PageDocument } from "@/lib/documents";
import { BLOCK_CATALOG, getBlockSpec } from "@/lib/registry";

export interface PageStudioClientProps {
  readonly initialDocument: PageDocument;
  readonly initialLockVersion: number;
  readonly initialTitle: string;
  readonly pageId: string;
  readonly pageSlug: string;
  readonly pageStatus: string;
  readonly siteId: string;
}

export function PageStudioClient({
  initialDocument,
  initialLockVersion,
  initialTitle,
  pageId,
  pageSlug,
  pageStatus,
  siteId,
}: PageStudioClientProps) {
  const t = useTranslations();
  const [title, setTitle] = useState(initialTitle);
  const [lockVersion, setLockVersion] = useState(initialLockVersion);
  const [blocks, setBlocks] = useState<BlockNode[]>([
    ...initialDocument.content,
  ]);
  const [selectedAlias, setSelectedAlias] = useState<string>(
    BLOCK_CATALOG[0]?.alias ?? "hero-banner",
  );
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const blockOptions = BLOCK_CATALOG.map((item) => ({
    label: `${item.name} (${item.group})`,
    value: item.alias,
  }));

  function buildCurrentDocument(): PageDocument {
    return {
      schemaVersion: 1,
      root: { title },
      content: blocks,
    };
  }

  function handleAddBlock() {
    const spec = getBlockSpec(selectedAlias);
    if (!spec) {
      return;
    }
    const nextNode: BlockNode = {
      id: `${spec.alias}-${Date.now()}`,
      type: spec.alias,
      props: { ...spec.defaultProps },
    };
    setBlocks((prev) => [...prev, nextNode]);
  }

  function handleUpdateProp(blockId: string, key: string, value: string) {
    setBlocks((prev) =>
      prev.map((item) =>
        item.id === blockId
          ? { ...item, props: { ...item.props, [key]: value } }
          : item,
      ),
    );
  }

  function handleRemoveBlock(blockId: string) {
    setBlocks((prev) => prev.filter((item) => item.id !== blockId));
  }

  function handleSaveRevision() {
    startTransition(async () => {
      try {
        const saved = await saveDraftAction({
          document: buildCurrentDocument(),
          expectedLockVersion: lockVersion,
          pageId,
          siteId,
          title,
        });
        setLockVersion(saved.lockVersion);
        setStatusMessage(t("common.save"));
      } catch (err) {
        setStatusMessage(
          err instanceof Error ? err.message : t("feedback.errorTitle"),
        );
      }
    });
  }

  function handlePublish() {
    startTransition(async () => {
      try {
        const saved = await saveDraftAction({
          document: buildCurrentDocument(),
          expectedLockVersion: lockVersion,
          pageId,
          siteId,
          title,
        });
        setLockVersion(saved.lockVersion);
        await publishPageAction({ pageId, siteId });
        setStatusMessage(t("studio.publishNow"));
      } catch (err) {
        setStatusMessage(
          err instanceof Error ? err.message : t("feedback.errorTitle"),
        );
      }
    });
  }

  function handleSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const date = String(data.get("scheduleDate") ?? "");
    const time = String(data.get("scheduleTime") ?? "");
    startTransition(async () => {
      try {
        await schedulePageAction({
          pageId,
          publishAt: date
            ? new Date(`${date}T${time || "00:00"}:00`).toISOString()
            : null,
          siteId,
          unpublishAt: null,
        });
        setStatusMessage(t("studio.scheduled"));
      } catch (err) {
        setStatusMessage(
          err instanceof Error ? err.message : t("feedback.errorTitle"),
        );
      }
    });
  }

  const editorContent = (
    <Stack gap="lg">
      <Surface>
        <Stack gap="md">
          <Label htmlFor="studio-page-title">{t("pages.pageTitleLabel")}</Label>
          <Input
            id="studio-page-title"
            name="title"
            onChange={(event) => setTitle(event.currentTarget.value)}
            value={title}
          />
          <Stack align="center" direction="row" gap="sm">
            <FormSelect
              name="blockAlias"
              onChange={setSelectedAlias}
              options={blockOptions}
              value={selectedAlias}
            />
            <Button onClick={handleAddBlock} variant="secondary">
              {t("studio.blockLibrary")}
            </Button>
          </Stack>
        </Stack>
      </Surface>

      {blocks.length === 0 ? (
        <Surface tone="muted">
          <Text tone="secondary">{t("studio.emptyCanvas")}</Text>
        </Surface>
      ) : (
        blocks.map((block) => (
          <Surface key={block.id}>
            <Stack gap="sm">
              <Stack align="between" direction="row" gap="sm">
                <Badge tone="accent">{block.type}</Badge>
                <Button
                  onClick={() => handleRemoveBlock(block.id)}
                  variant="danger"
                >
                  {t("common.remove")}
                </Button>
              </Stack>
              <Label htmlFor={`headline-${block.id}`}>
                {t("pages.pageTitleLabel")}
              </Label>
              <Input
                id={`headline-${block.id}`}
                name={`headline-${block.id}`}
                onChange={(event) =>
                  handleUpdateProp(
                    block.id,
                    "headline",
                    event.currentTarget.value,
                  )
                }
                value={
                  typeof block.props.headline === "string"
                    ? block.props.headline
                    : ""
                }
              />
              <Label htmlFor={`body-${block.id}`}>
                {t("studio.inspector")}
              </Label>
              <Textarea
                id={`body-${block.id}`}
                name={`body-${block.id}`}
                onChange={(event) =>
                  handleUpdateProp(block.id, "body", event.currentTarget.value)
                }
                value={
                  typeof block.props.body === "string" ? block.props.body : ""
                }
              />
            </Stack>
          </Surface>
        ))
      )}
    </Stack>
  );

  const previewContent = <DocumentRenderer document={buildCurrentDocument()} />;

  return (
    <Stack gap="lg">
      <Surface>
        <Stack align="between" direction="row" gap="md">
          <Stack gap="sm">
            <Text as="h1" variant="heading">
              {title}
            </Text>
            <Stack direction="row" gap="sm">
              <Badge>{pageSlug}</Badge>
              <Badge tone="accent">{pageStatus}</Badge>
            </Stack>
          </Stack>
          <Stack direction="row" gap="sm">
            <Button
              disabled={isPending}
              onClick={handleSaveRevision}
              variant="secondary"
            >
              {t("studio.saveRevision")}
            </Button>
            <Button
              disabled={isPending}
              onClick={handlePublish}
              variant="primary"
            >
              {t("studio.publishNow")}
            </Button>
          </Stack>
        </Stack>
      </Surface>

      <Surface>
        <Form onSubmit={handleSchedule}>
          <Stack gap="sm">
            <Text as="h2" variant="subheading">
              {t("studio.scheduleHeading")}
            </Text>
            <Label htmlFor="studio-schedule-date">
              {t("studio.scheduleDateLabel")}
            </Label>
            <DatePicker id="studio-schedule-date" name="scheduleDate" />
            <Label htmlFor="studio-schedule-time">
              {t("studio.scheduleTimeLabel")}
            </Label>
            <TimePicker id="studio-schedule-time" name="scheduleTime" />
          </Stack>
          <Button disabled={isPending} type="submit" variant="secondary">
            {t("studio.scheduleSubmit")}
          </Button>
        </Form>
      </Surface>

      {statusMessage ? <LiveRegion>{statusMessage}</LiveRegion> : null}

      <TabsPanel
        defaultValue="editor"
        tabs={[
          {
            content: editorContent,
            label: t("studio.title"),
            value: "editor",
          },
          {
            content: previewContent,
            label: t("studio.previewDraft"),
            value: "preview",
          },
        ]}
      />
    </Stack>
  );
}
