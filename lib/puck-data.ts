import type { PageDocument } from "@/lib/documents";

export function withPuckIds(document: PageDocument): PageDocument {
  const id = () => globalThis.crypto.randomUUID();
  const ensure = (node: { type: string; props: Record<string, unknown> & { id?: string } }) => ({
    ...node,
    props: { id: node.props?.id ?? id(), ...node.props },
  });

  return {
    ...document,
    root: {
      ...document.root,
      props: {
        id: (document.root?.props as { id?: string })?.id ?? id(),
        ...document.root?.props,
      } as PageDocument["root"]["props"],
    },
    content: (document.content ?? []).map(ensure),
    ...(document.zones
      ? {
          zones: Object.fromEntries(
            Object.entries(document.zones).map(([zone, nodes]) => [zone, (nodes ?? []).map(ensure)]),
          ),
        }
      : {}),
  };
}
