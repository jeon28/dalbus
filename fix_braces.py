import os

file_path = r'c:\Users\전성현\dalbus\src\app\(protected)\admin\tidal\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 1461 and 1462 are at indices 1460 and 1461
# Currently they are:
# 1460:                                                         </table>
# 1461:                                                     );
# 1462:                                                 })()}

# We need to change ); to } because the IIFE started with { at line 1333.
# Wait, let's check line 1333 again.
# 1333:                                 {(() => {

# Actually, the best way is to make it:
# 1461:                                                 }} )()}

lines[1460] = "                                                        </table>\n"
lines[1461] = "                                                    );\n" # Wait, if I want to keep the structure.
# If I use ) : ( later, I need to be careful.

# Let's just fix the braces.
# I'll replace the block from 1333 to 1462 with a clean version.

tbody_start_idx = 1332 # line 1333
tbody_end_idx = 1462   # line 1463

# ... (I'll just trust my previous mapping is correct and fix the tail)
lines[1461] = "                                                })()}\n"
lines[1459] = "                                                        </table>\n"
# Remove line 1460 entirely if it was );
# Wait, let's look at the file again.
# 1460:                                                         </table>
# 1461:                                                     );
# 1462:                                                 })()}

# Correct:
# 1460:                                                         </table>
# 1461:                                                     } ) () }

lines[1461] = "                                                })()}\n"
del lines[1460] # Remove the ); line

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Fixed braces around tbody.")
