"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { connectDomainAction } from "@/app/server/domains/actions";
import { createPageAction } from "@/app/server/pages/actions";
import { requestContactErasureAction } from "@/app/server/privacy/actions";
import { createSiteAction } from "@/app/server/sites/actions";
import { inviteMemberAction } from "@/app/server/team/actions";
import {
  Button,
  Form,
  FormSelect,
  Input,
  Label,
  LiveRegion,
  Stack,
  Surface,
  Text,
} from "@/components/ui";
import { useTranslations } from "@/hooks/use-translations";
import type { AccountRole } from "@/lib/enums";
import { APP_PATHS } from "@/lib/paths";

export function CreateSiteFormClient() {
  const t = useTranslations();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const res = await createSiteAction({
          name,
          slug: slug.trim() || undefined,
        });
        router.push(APP_PATHS.siteDetail(res.siteId));
        router.refresh();
      } catch (err) {
        setMessage(
          err instanceof Error ? err.message : t("feedback.errorTitle"),
        );
      }
    });
  }

  return (
    <Surface>
      <Stack gap="md">
        <Text as="h2" variant="subheading">
          {t("sites.createSite")}
        </Text>
        {message ? <LiveRegion assertive>{message}</LiveRegion> : null}
        <Form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <Label htmlFor="site-name">{t("sites.siteNameLabel")}</Label>
            <Input
              id="site-name"
              name="name"
              onChange={(event) => setName(event.currentTarget.value)}
              required
              value={name}
            />
          </Stack>
          <Stack gap="sm">
            <Label htmlFor="site-slug">{t("sites.siteSlugLabel")}</Label>
            <Input
              id="site-slug"
              name="slug"
              onChange={(event) => setSlug(event.currentTarget.value)}
              required
              value={slug}
            />
          </Stack>
          <Button disabled={isPending} type="submit">
            {t("common.create")}
          </Button>
        </Form>
      </Stack>
    </Surface>
  );
}

export function CreatePageFormClient({ siteId }: { readonly siteId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const res = await createPageAction({ siteId, slug, title });
        router.push(APP_PATHS.siteEditor(siteId, res.pageId));
        router.refresh();
      } catch (err) {
        setMessage(
          err instanceof Error ? err.message : t("feedback.errorTitle"),
        );
      }
    });
  }

  return (
    <Surface>
      <Stack gap="md">
        <Text as="h2" variant="subheading">
          {t("pages.createPage")}
        </Text>
        {message ? <LiveRegion assertive>{message}</LiveRegion> : null}
        <Form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <Label htmlFor="new-page-title">{t("pages.pageTitleLabel")}</Label>
            <Input
              id="new-page-title"
              name="title"
              onChange={(event) => setTitle(event.currentTarget.value)}
              required
              value={title}
            />
          </Stack>
          <Stack gap="sm">
            <Label htmlFor="new-page-slug">{t("pages.pageSlugLabel")}</Label>
            <Input
              id="new-page-slug"
              name="slug"
              onChange={(event) => setSlug(event.currentTarget.value)}
              placeholder="/about"
              required
              value={slug}
            />
          </Stack>
          <Button disabled={isPending} type="submit">
            {t("common.create")}
          </Button>
        </Form>
      </Stack>
    </Surface>
  );
}

export function AddDomainFormClient({ siteId }: { readonly siteId: string }) {
  const t = useTranslations();
  const [hostname, setHostname] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        await connectDomainAction({ hostname, siteId });
        setMessage(t("domains.verifyNow"));
        setHostname("");
      } catch (err) {
        setMessage(
          err instanceof Error ? err.message : t("feedback.errorTitle"),
        );
      }
    });
  }

  return (
    <Surface>
      <Stack gap="md">
        <Text as="h2" variant="subheading">
          {t("domains.addDomain")}
        </Text>
        {message ? <LiveRegion>{message}</LiveRegion> : null}
        <Form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <Label htmlFor="domain-hostname">
              {t("domains.hostnameLabel")}
            </Label>
            <Input
              id="domain-hostname"
              name="hostname"
              onChange={(event) => setHostname(event.currentTarget.value)}
              placeholder="www.example.com"
              required
              value={hostname}
            />
          </Stack>
          <Button disabled={isPending} type="submit">
            {t("domains.addDomain")}
          </Button>
        </Form>
      </Stack>
    </Surface>
  );
}

export function InviteMemberFormClient() {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AccountRole>("editor");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        await inviteMemberAction({ email, role });
        setMessage(t("team.inviteMember"));
        setEmail("");
      } catch (err) {
        setMessage(
          err instanceof Error ? err.message : t("feedback.errorTitle"),
        );
      }
    });
  }

  return (
    <Surface>
      <Stack gap="md">
        <Text as="h2" variant="subheading">
          {t("team.inviteMember")}
        </Text>
        {message ? <LiveRegion>{message}</LiveRegion> : null}
        <Form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <Label htmlFor="invite-email">{t("auth.emailLabel")}</Label>
            <Input
              id="invite-email"
              name="email"
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
              type="email"
              value={email}
            />
          </Stack>
          <Stack gap="sm">
            <Label htmlFor="invite-role">{t("team.roleLabel")}</Label>
            <FormSelect
              id="invite-role"
              name="role"
              onChange={(next) => setRole(next as AccountRole)}
              options={[
                { label: "Admin", value: "admin" },
                { label: "Editor", value: "editor" },
                { label: "Viewer", value: "viewer" },
              ]}
              value={role}
            />
          </Stack>
          <Button disabled={isPending} type="submit">
            {t("team.inviteMember")}
          </Button>
        </Form>
      </Stack>
    </Surface>
  );
}

export function PrivacyErasureFormClient() {
  const t = useTranslations();
  const [rawContact, setRawContact] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      await requestContactErasureAction({ rawContact });
      setSubmitted(true);
      setRawContact("");
    });
  }

  return (
    <Surface className="mx-auto max-w-lg">
      <Stack gap="md">
        <Text as="h1" variant="heading">
          {t("privacy.myDataTitle")}
        </Text>
        <Text tone="secondary" variant="body">
          {t("privacy.myDataDescription")}
        </Text>
        {submitted ? (
          <LiveRegion>{t("privacy.erasureSubmitted")}</LiveRegion>
        ) : null}
        <Form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <Label htmlFor="erasure-contact">{t("privacy.contactLabel")}</Label>
            <Input
              id="erasure-contact"
              name="rawContact"
              onChange={(event) => setRawContact(event.currentTarget.value)}
              required
              value={rawContact}
            />
          </Stack>
          <Button disabled={isPending} type="submit">
            {t("privacy.submitErasure")}
          </Button>
        </Form>
      </Stack>
    </Surface>
  );
}
