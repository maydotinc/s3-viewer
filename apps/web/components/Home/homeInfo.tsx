import { fetchFolders } from "@/utils/fetching";
import { signOut } from "@s3-viewer/auth/client";
import { Button } from "@s3-viewer/ui/components/button";
import { Separator } from "@s3-viewer/ui/components/separator";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/router";
import { BucketTable } from "./BucketsTable/bucketTable";
import { columns } from "./BucketsTable/columns";
import Hero from "./hero";

export default function HomeInfo() {
    const router = useRouter();
    const { data: folders, isLoading: isLoadingFolders } = useQuery({
        queryKey: ['folders'],
        queryFn: fetchFolders,
        refetchOnMount: true,
    });

    console.log(folders);

    const handleSignOut = () => {
        signOut({
          fetchOptions: {
            onSuccess: () => {
              router.push("/connect");
            },
          },
        });
    };
        
    return (
        <div className="flex flex-col px-8 py-4 gap-4 w-full">
            <Hero />
            <Separator />
            {isLoadingFolders ? (
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="w-4 h-4 animate-spin" />
                </div>
            ) : (
                <BucketTable columns={columns} data={folders ?? []} />
            )}
            <Button onClick={handleSignOut}>
                Sign Out
            </Button>
        </div>
    )
}