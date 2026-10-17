import { redirect } from "next/navigation";
import { positionStaticParams } from "@/lib/staticParams";

export function generateStaticParams() {
  return positionStaticParams();
}

export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }> };

export default async function LegacyPosicaoRedirect({ params }: Props) {
  const { slug } = await params;
  redirect(`/serie-a/posicao/${slug}`);
}
