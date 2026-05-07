import { Order } from "@/generated/prisma/client";

interface OrderTableProps {
  orders: Order[];
}

export default function OrderTable({ orders }: OrderTableProps) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>暂无订单数据</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
              外部编码
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
              发件人姓名
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
              发件人电话
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
              发件人地址
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
              收件人姓名
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
              收件人电话
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
              收件人地址
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">
              重量(kg)
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[60px]">
              件数
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[60px]">
              温层
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
              备注
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">
              创建时间
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                {order.customerOrderNumber || "-"}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                {order.senderName || "-"}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                {order.senderPhone || "-"}
              </td>
              <td className="px-3 py-2 text-sm text-gray-900 truncate max-w-[150px]" title={order.senderAddress || ""}>
                {order.senderAddress || "-"}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                {order.receiverName || "-"}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                {order.receiverPhone || "-"}
              </td>
              <td className="px-3 py-2 text-sm text-gray-900 truncate max-w-[150px]" title={order.receiverAddress || ""}>
                {order.receiverAddress || "-"}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                {order.goodsWeight || "-"}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                {order.goodsPieces || "-"}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                {order.goodsType || "-"}
              </td>
              <td className="px-3 py-2 text-sm text-gray-900 truncate max-w-[100px]" title={order.remark || ""}>
                {order.remark || "-"}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                {new Date(order.createdAt).toLocaleString("zh-CN")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
