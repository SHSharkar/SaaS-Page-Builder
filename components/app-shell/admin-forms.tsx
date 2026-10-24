"use client";

import { useState, useTransition } from "react";
import { setAccountStatusPlatformAction } from "@/app/server/admin/actions";
import { revealContactForPlatformAction } from "@/app/server/privacy/actions";
import {
  Button,
  Form,
  Input,
  Label,
  LiveRegion,
  Stack,
  Surface,
  Text,
} from "@/components/ui";
import { useTranslations } from "@/hooks/use-translations";

export function AdminAccountStatusButton({
  accountId,
  currentStatus,
}: {
  readonly accountId: string;
  readonly currentStatus: string;
}) {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const nextStatus: "active" | "suspended" =
    currentStatus === "active" ? "suspended" : "active";

  return (
    <Button
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await setAccountStatusPlatformAction({
            accountId,
            status: nextStatus,
          });
        });
      }}
      variant={currentStatus === "active" ? "danger" : "secondary"}
    >
      {currentStatus === "active" ? t("common.remove") : t("common.confirm")}
    </Button>
  );
}

export function AdminRevealContactFormClient() {
  const t = useTranslations();
  const [contactId, setContactId] = useState("");
  const [reason, setReason] = useState("");
  const [revealed, setRevealed] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const res = await revealContactForPlatformAction({ contactId, reason });
        setRevealed(res.contact);
      } catch (err) {
        setRevealed(
          err instanceof Error ? err.message : t("feedback.errorTitle"),
        );
      }
    });
  }

  return (
    <Surface>
      <Stack gap="md">
        <Text as="h2" variant="subheading">
          {t("admin.revealContactButton")}
        </Text>
        {revealed ? <LiveRegion>{revealed}</LiveRegion> : null}
        <Form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <Label htmlFor="reveal-contact-id">
              {t("privacy.contactLabel")}
            </Label>
            <Input
              id="reveal-contact-id"
              name="contactId"
              onChange={(event) => setContactId(event.currentTarget.value)}
              required
              value={contactId}
            />
          </Stack>
          <Stack gap="sm">
            <Label htmlFor="reveal-reason">
              {t("admin.revealReasonLabel")}
            </Label>
            <Input
              id="reveal-reason"
              name="reason"
              onChange={(event) => setReason(event.currentTarget.value)}
              required
              value={reason}
            />
          </Stack>
          <Button disabled={isPending} type="submit" variant="danger">
            {t("admin.revealContactButton")}
          </Button>
        </Form>
      </Stack>
    </Surface>
  );
}
