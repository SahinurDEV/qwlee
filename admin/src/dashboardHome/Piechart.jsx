 
import { PieChart, Pie, Cell, } from 'recharts';

const data = [
  { name: 'Group A', value: 400 },
  { name: 'Group B', value: 300 },
   
];

const COLORS = ['#0088FE', '#FF8042'];

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};
import { Select} from 'antd';
import { useGetUserRatioQuery } from '../redux/api/apiSlice';
import { useState } from 'react';


const Piechart = () => { 

const [month, setMonth] = useState('august')
const {data:userRatio, isLoading, error} = useGetUserRatioQuery(month)
console.log(userRatio?.data?.attributes);

const handleChange = (value) => {
  
  setMonth(value)
};

    return (
        <div>
            <div className='flex justify-between items-center py-2 mx-6'>
            <div>
            <h1 className=' font-medium text-6 '>User Ratio {userRatio?.data?.attributes?.ratio}</h1>
            </div>
           <div>
           <Select
      defaultValue={month} className=' border-none'
      style={{
        width: 100,
        border:"none"
      }}
      onChange={handleChange}
      options={[
        { value: 'jan', label: 'January' },
        { value: 'feb', label: 'February' },
        { value: 'mar', label: 'March' },
        { value: 'apr', label: 'April' },
        { value: 'may', label: 'May' },
        { value: 'jun', label: 'June' },
        { value: 'jul', label: 'July' },
        { value: 'aug', label: 'August' },
        { value: 'sep', label: 'September' },
        { value: 'oct', label: 'October' },
        { value: 'nov', label: 'November' },
        { value: 'dec', label: 'December' },
         
      ]}
    />
           </div>
    
            </div>  
            <hr className='text-[#B0EBCF] py-1 text-xl' />
            <div className='flex justify-around items-center gap-3'>
                <div>
                <PieChart className='px-2' width={170} 
          height={160}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
                </div>
                <div>
                      <div>
                      <p className='text-xs font-normal'>Month of {userRatio?.data?.attributes?.month} buyer</p>
                      <h1 className='text-[18px] font-semibold'>{userRatio?.data?.attributes?.totalBuyers}</h1>
                      </div>
                      <div className='mt-[23px]'>
                      <p className='text-xs font-normal'>Month of {userRatio?.data?.attributes?.month} Frelancers</p>
                      <h1 className='text-[18px] font-semibold'>{userRatio?.data?.attributes?.totalFreelancers}</h1>
                      </div>
                </div>
            </div>
         
        </div>
    );
};

export default Piechart;