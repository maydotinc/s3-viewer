import { signOut, useSession } from "@s3-viewer/auth/client";
import { Badge } from "@s3-viewer/ui/components/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@s3-viewer/ui/components/dropdown-menu";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ChevronDown, CircleUserRound } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useState } from "react";

const ProfileDropdown = () => {
    const { data } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();
    const image = data?.user.image;
    const name = data?.user.name;

    const handleSignOut = () => {
        signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/connect");
                }
            }
        });
    }

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Badge className="rounded-full border border-viewerborder p-0 m-0 h-fit flex items-center gap-2 justify-between select-none cursor-pointer">
                    <div className="flex items-center w-12 h-9">
                        { image ? (
                            <Image src={image} alt={"Profile"} className="rounded-full object-cover" fill />
                        ) : (
                            <CircleUserRound className="size-9" />
                        )}
                    </div>
                    <span className="text-base text-viewerblack font-medium min-w-12 text-center">
                        {name ? name : "Guest"}
                    </span>
                    <ChevronDown className={cn("size-4 text-gray-600 transition-transform duration-200", { "rotate-180": isOpen })} />
                </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default ProfileDropdown;