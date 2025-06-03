import { useSession } from "@s3-viewer/auth/client";
import { Badge } from "@s3-viewer/ui/components/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@s3-viewer/ui/components/dropdown-menu";
import { ChevronDown, CircleUserRound } from "lucide-react";
import Image from "next/image";

const ProfileDropdown = () => {
    const { data } = useSession();
    const image = data?.user.image;
    const name = data?.user.name;
    
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Badge className="rounded-full p-0 m-0 h-fit flex items-center gap-2 justify-between select-none cursor-pointer">
                    <div className="flex items-center w-12 h-9">
                        { image ? (
                            <Image src={image} alt={"Profile"} className="rounded-full object-cover" fill />
                        ) : (
                            <CircleUserRound className="size-9" />
                        )}
                    </div>
                    <span className="text-base font-medium min-w-12 text-center">
                        {name ? name : "Guest"}
                    </span>
                    <ChevronDown className="size-6" />
                </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Billing</DropdownMenuItem>
                <DropdownMenuItem>Team</DropdownMenuItem>
                <DropdownMenuItem>Subscription</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default ProfileDropdown;