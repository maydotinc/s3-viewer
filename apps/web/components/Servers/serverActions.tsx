import { ServerInfo } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@s3-viewer/ui/components/dropdown-menu";
import { ChevronRight, PenLine, WifiOff } from "lucide-react";

type ServerActionsProps = {
    server: ServerInfo;
}

const ServerActions = ({ server }: ServerActionsProps) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger>
                <Button variant="ghost" size="icon">
                    <ChevronRight />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right">
                <DropdownMenuItem><PenLine />Edit</DropdownMenuItem>
                <DropdownMenuItem><WifiOff />Disconnect Server</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default ServerActions;