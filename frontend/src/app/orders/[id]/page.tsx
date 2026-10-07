import { CustomerOrderDetail } from "@/components/customer-order-detail";
export default async function OrderDetail({params}:{params:Promise<{id:string}>}){const {id}=await params;return <CustomerOrderDetail number={id}/>;}
