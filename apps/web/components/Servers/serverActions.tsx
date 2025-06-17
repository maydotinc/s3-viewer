import { ServerInfo } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@s3-viewer/ui/components/dropdown-menu";
import { ChevronRight, PenLine, WifiOff } from "lucide-react";

type ServerActionsProps = {
    server: ServerInfo;
    className?: string;
}

const ServerActions = ({ server, className }: ServerActionsProps) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="ml-auto p-0">
                <ChevronRight />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" className="rounded-xl text-viewerblack">
                <DropdownMenuItem>
                    <PenLine />Edit
                </DropdownMenuItem>
                <DropdownMenuItem>
                    <Button variant="destructive" className="gap-2 w-full">
                        <WifiOff className="size-4 text-viewertextred" />Disconnect Server
                    </Button>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default ServerActions;