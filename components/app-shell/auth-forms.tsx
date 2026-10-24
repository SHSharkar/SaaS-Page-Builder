"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { authClient } from "@/app/lib/auth-client";
import { signUpWorkspaceAction } from "@/app/server/signup/actions";
import {
  AppLink,
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
import { APP_PATHS, PUBLIC_PATHS } from "@/lib/paths";

export function SignInFormClient() {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    startTransition(async () => {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (result.error) {
        setErrorMessage(t("auth.invalidCredentials"));
        return;
      }
      router.push(APP_PATHS.dashboard);
      router.refresh();
    });
  }

  return (
    <Surface className="mx-auto max-w-md">
      <Stack gap="md">
        <Text as="h1" variant="heading">
          {t("auth.signInTitle")}
        </Text>
        <Text tone="secondary" variant="body">
          {t("auth.signInSubtitle")}
        </Text>
        {errorMessage ? (
          <LiveRegion assertive>{errorMessage}</LiveRegion>
        ) : null}
        <Form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <Label htmlFor="signin-email">{t("auth.emailLabel")}</Label>
            <Input
              autoComplete="email"
              id="signin-email"
              name="email"
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
              type="email"
              value={email}
            />
          </Stack>
          <Stack gap="sm">
            <Label htmlFor="signin-password">{t("auth.passwordLabel")}</Label>
            <Input
              autoComplete="current-password"
              id="signin-password"
              name="password"
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
              type="password"
              value={password}
            />
          </Stack>
          <Button disabled={isPending} type="submit" variant="primary">
            {t("auth.submitSignIn")}
          </Button>
        </Form>
        <Stack direction="row" gap="sm">
          <AppLink href={PUBLIC_PATHS.forgotPassword} variant="inline">
            {t("auth.forgotPasswordTitle")}
          </AppLink>
          <AppLink href={PUBLIC_PATHS.signUp} variant="inline">
            {t("nav.signUp")}
          </AppLink>
        </Stack>
      </Stack>
    </Surface>
  );
}

export function SignUpFormClient() {
  const t = useTranslations();
  const router = useRouter();
  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    startTransition(async () => {
      try {
        await signUpWorkspaceAction({
          clientKey: email.trim().toLowerCase() || "browser",
          email,
          name,
          password,
          workspaceName,
        });
        const signedIn = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (signedIn.error) {
          router.push(PUBLIC_PATHS.signIn);
          return;
        }
        router.push(APP_PATHS.dashboard);
        router.refresh();
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : t("feedback.errorTitle"),
        );
      }
    });
  }

  return (
    <Surface className="mx-auto max-w-md">
      <Stack gap="md">
        <Text as="h1" variant="heading">
          {t("auth.signUpTitle")}
        </Text>
        <Text tone="secondary" variant="body">
          {t("auth.signUpSubtitle")}
        </Text>
        {errorMessage ? (
          <LiveRegion assertive>{errorMessage}</LiveRegion>
        ) : null}
        <Form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <Label htmlFor="signup-name">{t("auth.nameLabel")}</Label>
            <Input
              autoComplete="name"
              id="signup-name"
              name="name"
              onChange={(event) => setName(event.currentTarget.value)}
              required
              value={name}
            />
          </Stack>
          <Stack gap="sm">
            <Label htmlFor="signup-workspace">{t("auth.workspaceLabel")}</Label>
            <Input
              id="signup-workspace"
              name="workspaceName"
              onChange={(event) => setWorkspaceName(event.currentTarget.value)}
              required
              value={workspaceName}
            />
          </Stack>
          <Stack gap="sm">
            <Label htmlFor="signup-email">{t("auth.emailLabel")}</Label>
            <Input
              autoComplete="email"
              id="signup-email"
              name="email"
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
              type="email"
              value={email}
            />
          </Stack>
          <Stack gap="sm">
            <Label htmlFor="signup-password">{t("auth.passwordLabel")}</Label>
            <Input
              autoComplete="new-password"
              id="signup-password"
              name="password"
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
              type="password"
              value={password}
            />
          </Stack>
          <Button disabled={isPending} type="submit" variant="primary">
            {t("auth.submitSignUp")}
          </Button>
        </Form>
      </Stack>
    </Surface>
  );
}

export function SignOutCardClient() {
  const t = useTranslations();

  useEffect(() => {
    void authClient.signOut();
  }, []);

  return (
    <Surface className="mx-auto max-w-md">
      <Stack gap="md">
        <Text as="h1" variant="heading">
          {t("auth.signedOutTitle")}
        </Text>
        <Text tone="secondary" variant="body">
          {t("auth.signedOutSubtitle")}
        </Text>
        <AppLink href={PUBLIC_PATHS.signIn} variant="button">
          {t("nav.signIn")}
        </AppLink>
      </Stack>
    </Surface>
  );
}
