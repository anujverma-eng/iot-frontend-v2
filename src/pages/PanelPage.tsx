import React from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  useDisclosure,
  Tooltip,
  Chip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { CreateDashboardModal } from "../components/Panel/CreateDashboardModal";

interface Dashboard {
  id: string;
  name: string;
  createdAt: Date;
  lastSavedAt: Date;
  isFavorite: boolean;
}

export const PanelPage: React.FC = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [dashboards, setDashboards] = React.useState<Dashboard[]>([
    {
      id: "1",
      name: "Main Dashboard",
      createdAt: new Date(2023, 0, 15),
      lastSavedAt: new Date(2023, 5, 20),
      isFavorite: true,
    },
    {
      id: "2",
      name: "Sensor Overview",
      createdAt: new Date(2023, 2, 10),
      lastSavedAt: new Date(2023, 6, 5),
      isFavorite: false,
    },
  ]);

  const handleDeleteDashboard = (id: string) => {
    setDashboards(dashboards.filter(dashboard => dashboard.id !== id));
  };

  const handleToggleFavorite = (id: string) => {
    setDashboards(dashboards.map(dashboard => 
      dashboard.id === id ? { ...dashboard, isFavorite: !dashboard.isFavorite } : dashboard
    ));
  };

  return (
    <div className="container mx-auto max-w-7xl px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Dashboard Panel</h1>
          <Button color="primary" onPress={onOpen} startContent={<Icon icon="lucide:plus" />}>
            Create Dashboard
          </Button>
        </div>

        <Table aria-label="Dashboards table">
          <TableHeader>
            <TableColumn>DASHBOARD NAME</TableColumn>
            <TableColumn>CREATED AT</TableColumn>
            <TableColumn>LAST SAVED</TableColumn>
            <TableColumn>ACTIONS</TableColumn>
          </TableHeader>
          <TableBody>
            {dashboards.map((dashboard) => (
              <TableRow key={dashboard.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {dashboard.name}
                    {dashboard.isFavorite && (
                      <Chip color="warning" variant="flat" size="sm">Favorite</Chip>
                    )}
                  </div>
                </TableCell>
                <TableCell>{format(dashboard.createdAt, "MMM d, yyyy")}</TableCell>
                <TableCell>{format(dashboard.lastSavedAt, "MMM d, yyyy HH:mm")}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Tooltip content="View Dashboard">
                      <Button isIconOnly variant="light" onPress={() => {}}>
                        <Icon icon="lucide:eye" className="text-default-500" />
                      </Button>
                    </Tooltip>
                    <Tooltip content={dashboard.isFavorite ? "Remove from Favorites" : "Add to Favorites"}>
                      <Button isIconOnly variant="light" onPress={() => handleToggleFavorite(dashboard.id)}>
                        <Icon 
                          icon={dashboard.isFavorite ? "lucide:star" : "lucide:star"} 
                          className={dashboard.isFavorite ? "text-warning-500" : "text-default-500"}
                        />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Delete Dashboard" color="danger">
                      <Button isIconOnly variant="light" color="danger" onPress={() => handleDeleteDashboard(dashboard.id)}>
                        <Icon icon="lucide:trash-2" />
                      </Button>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <CreateDashboardModal isOpen={isOpen} onClose={onClose} />
      </motion.div>
    </div>
  );
};