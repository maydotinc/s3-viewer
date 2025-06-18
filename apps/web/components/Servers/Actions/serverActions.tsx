import { ServerInfo } from "@s3-viewer/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@s3-viewer/ui/components/dropdown-menu";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ChevronRight, WifiOff } from "lucide-react";
import { useState } from "react";
import ServerEdit from "./serverEdit";

type ServerActionsProps = {
    server: ServerInfo;
}

const ServerActions = ({ server }: ServerActionsProps) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger>
                <ChevronRight className={cn("size-4 transition-transform duration-200", { "rotate-180": isOpen })} />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
                <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="cursor-pointer w-full"
                >
                    <ServerEdit />
                </DropdownMenuItem>
                <DropdownMenuItem
                    variant="destructive"
                    onSelect={(e) => e.preventDefault()}
                >
                    <WifiOff className="size-4 text-viewertextred" />
                    Disconnect Server
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default ServerActions;