"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/Spinner";

const ProvinceMapInner = dynamic(() => import("./ProvinceMapInner"), {
  ssr: false,
  loading: () => (
    <div className="h-[380px] w-full rounded-xl bg-bg flex items-center justify-center gap-2 text-sm text-textSoft">
      <Spinner /> Chargement…
    </div>
  ),
});

interface ProvinceMapProps {
  data: { province: string; count: number }[];
}

/** One bubble per province/state (never per city - see lib/geo.ts), sized by contact count. */
export function ProvinceMap({ data }: ProvinceMapProps) {
  return <ProvinceMapInner data={data} />;
}
