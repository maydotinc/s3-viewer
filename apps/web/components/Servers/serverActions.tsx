import { ServerInfo } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { DropdownMenu, DropdownMenuTrigger } from "@s3-viewer/ui/components/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

type ServerActionsProps = {
    server: ServerInfo;
}

const ServerActions = ({ server }: ServerActionsProps) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger>
                <Button>
                    <MoreHorizontal />
                </Button>
            </DropdownMenuTrigger>
        </DropdownMenu>
    )
}

export default ServerActions;