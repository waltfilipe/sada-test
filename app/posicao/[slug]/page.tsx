import { redirect } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export default async function LegacyPosicaoRedirect({ params }: Props) {
  const { slug } = await params;
  redirect(`/serie-a/posicao/${slug}`);
}
