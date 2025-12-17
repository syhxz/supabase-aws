type ConnectionStrings = {
  psql: string
  uri: string
  golang: string
  jdbc: string
  dotnet: string
  nodejs: string
  php: string
  python: string
  sqlalchemy: string
}

export const getConnectionStrings = ({
  connectionInfo,
  poolingInfo,
  metadata,
  revealPassword = false,
  actualPassword,
}: {
  connectionInfo: {
    db_user: string
    db_port: number
    db_host: string
    db_name: string
  }
  poolingInfo?: {
    connectionString: string
    db_user: string
    db_port: number
    db_host: string
    db_name: string
  }
  metadata: {
    projectRef?: string
    pgVersion?: string
  }
  revealPassword?: boolean
  actualPassword?: string
}): {
  direct: ConnectionStrings
  pooler: ConnectionStrings
} => {
  const isMd5 = poolingInfo?.connectionString.includes('options=reference')
  const { projectRef } = metadata
  const password = revealPassword && actualPassword ? actualPassword : '[YOUR_PASSWORD]'

  /**
   * Determines the appropriate username based on connection type and available information
   * Ensures correct user credentials are displayed for different permission levels
   */
  const determineUser = (providedUser: string, isReadOnly: boolean = false): string => {
    try {
      return getUsernameForPermissionLevel(isReadOnly, providedUser)
    } catch (error) {
      // If validation fails, fall back to a safe default
      console.warn(`Username validation failed: ${error}. Using default username.`)
      return isReadOnly ? 'supabase_read_only_user' : 'supabase_admin'
    }
  }

  // Direct connection variables - ensure proper parameter substitution with enhanced username handling
  // Requirements 2.1, 2.2, 2.3: Use actual values from auto-generated credentials
  const directUser = determineUser(connectionInfo.db_user, false) // Assume read-write for direct connections
  const directPort = connectionInfo.db_port || parseInt(process.env.POSTGRES_PORT || '5432', 10)
  const directHost = connectionInfo.db_host || process.env.POSTGRES_HOST || 'localhost'
  // Requirements 2.1, 2.2: Use actual database name from auto-generated credentials
  const directName = connectionInfo.db_name || process.env.POSTGRES_DB || 'postgres'

  // Pooler connection variables - ensure proper parameter substitution with enhanced username handling
  // Requirements 2.1, 2.2, 2.3: Use actual values from auto-generated credentials
  const poolerUser = determineUser(poolingInfo?.db_user || '', false) // Assume read-write for pooler connections
  const poolerPort = poolingInfo?.db_port || parseInt(process.env.POSTGRES_PORT || '5432', 10)
  const poolerHost = poolingInfo?.db_host || process.env.POSTGRES_HOST || 'localhost'
  // Requirements 2.1, 2.2: Use actual database name from auto-generated credentials
  const poolerName = poolingInfo?.db_name || process.env.POSTGRES_DB || 'postgres'

  // Direct connection strings
  // Requirements 2.1, 2.2, 2.3, 2.5: Format PostgreSQL connection strings with auto-generated credentials
  const directPsqlString = isMd5
    ? `psql "postgresql://${directUser}:${password}@${directHost}:${directPort}/${directName}"`
    : `psql -h ${directHost} -p ${directPort} -d ${directName} -U ${directUser}`

  // Requirements 2.1, 2.2, 2.3, 2.5: Ensure proper PostgreSQL URI format with auto-generated credentials
  const directUriString = `postgresql://${directUser}:${password}@${directHost}:${directPort}/${directName}`

  const directGolangString = `DATABASE_URL=${directUriString}`

  const directJdbcString = `jdbc:postgresql://${directHost}:${directPort}/${directName}?user=${directUser}&password=${password}`

  // User Id=${directUser};Password=${password};Server=${directHost};Port=${directPort};Database=${directName}`
  const directDotNetString = `{
  "ConnectionStrings": {
    "DefaultConnection": "Host=${directHost};Database=${directName};Username=${directUser};Password=${password};SSL Mode=Require;Trust Server Certificate=true"
  }
}`

  // `User Id=${poolerUser};Password=${password};Server=${poolerHost};Port=${poolerPort};Database=${poolerName}${isMd5 ? `;Options='reference=${projectRef}'` : ''}`
  const poolerDotNetString = `{
  "ConnectionStrings": {
    "DefaultConnection": "User Id=${poolerUser};Password=${password};Server=${poolerHost};Port=${poolerPort};Database=${poolerName}${isMd5 ? `;Options='reference=${projectRef}'` : ''}"
  }
}`

  const directNodejsString = `DATABASE_URL=${directUriString}`

  // Pooler connection strings
  const poolerPsqlString = isMd5
    ? `psql "postgresql://${poolerUser}:${password}@${poolerHost}:${poolerPort}/${poolerName}?options=reference%3D${projectRef}"`
    : `psql -h ${poolerHost} -p ${poolerPort} -d ${poolerName} -U ${poolerUser}`

  // Generate pooler URI string with password replacement support
  const poolerUriString = poolingInfo?.connectionString 
    ? poolingInfo.connectionString.replace(/:([^@]+)@/, `:${password}@`)
    : ''

  const nodejsPoolerUriString = `DATABASE_URL=${poolerUriString}`

  const poolerGolangString = `user=${poolerUser} 
password=${password} 
host=${poolerHost}
port=${poolerPort}
dbname=${poolerName}${isMd5 ? `options=reference=${projectRef}` : ''}`

  const poolerJdbcString = `jdbc:postgresql://${poolerHost}:${poolerPort}/${poolerName}?user=${poolerUser}${isMd5 ? `&options=reference%3D${projectRef}` : ''}&password=${password}`

  const sqlalchemyString = `user=${directUser} 
password=${password} 
host=${directHost} 
port=${directPort} 
dbname=${directName}`

  const poolerSqlalchemyString = `user=${poolerUser} 
password=${password} 
host=${poolerHost} 
port=${poolerPort} 
dbname=${poolerName}`

  return {
    direct: {
      psql: directPsqlString,
      uri: directUriString,
      golang: directGolangString,
      jdbc: directJdbcString,
      dotnet: directDotNetString,
      nodejs: directNodejsString,
      php: directGolangString,
      python: directGolangString,
      sqlalchemy: sqlalchemyString,
    },
    pooler: {
      psql: poolerPsqlString,
      uri: poolerUriString,
      golang: poolerGolangString,
      jdbc: poolerJdbcString,
      dotnet: poolerDotNetString,
      nodejs: nodejsPoolerUriString,
      php: poolerGolangString,
      python: poolerGolangString,
      sqlalchemy: poolerSqlalchemyString,
    },
  }
}

const DB_USER_DESC = 'Database user (e.g postgres)'
const DB_PASS_DESC = 'Database password'
const DB_NAME_DESC = 'Database name (e.g postgres)'
const PROJECT_REF_DESC = "Project's reference ID"
const PORT_NUMBER_DESC = 'Port number (Use 5432 if using prepared statements)'

/**
 * Replaces placeholder values in connection strings with actual configuration values
 * @param value - The value that might contain placeholders
 * @param actualValues - Object containing actual values to substitute
 * @returns The value with placeholders replaced
 */
function replacePlaceholders(value: string, actualValues: {
  user?: string
  password?: string
  host?: string
  port?: string | number
  database?: string
  projectRef?: string
}): string {
  let result = value
  
  // Replace common placeholders with actual values if available
  if (actualValues.user && result.includes('[user]')) {
    result = result.replace(/\[user\]/g, actualValues.user)
  }
  if (actualValues.password && result.includes('[password]')) {
    result = result.replace(/\[password\]/g, actualValues.password)
  }
  if (actualValues.host && result.includes('[host]')) {
    result = result.replace(/\[host\]/g, actualValues.host)
  }
  if (actualValues.port && result.includes('[port]')) {
    result = result.replace(/\[port\]/g, actualValues.port.toString())
  }
  if (actualValues.database && result.includes('[db-name]')) {
    result = result.replace(/\[db-name\]/g, actualValues.database)
  }
  if (actualValues.projectRef && result.includes('[project-ref]')) {
    result = result.replace(/\[project-ref\]/g, actualValues.projectRef)
  }
  
  return result
}

// [Joshen] This is to the best of interpreting the syntax from the API response
// // There's different format for PG13 (depending on authentication method being md5) and PG14
export const constructConnStringSyntax = (
  connString: string,
  {
    selectedTab,
    usePoolerConnection,
    ref,
    cloudProvider,
    region,
    tld,
    portNumber,
    actualConnectionInfo,
    revealPassword = false,
  }: {
    selectedTab: 'uri' | 'psql' | 'golang' | 'jdbc' | 'dotnet' | 'nodejs' | 'php' | 'python'
    usePoolerConnection: boolean
    ref: string
    cloudProvider: string
    region: string
    tld: string
    portNumber: string
    actualConnectionInfo?: {
      user?: string
      password?: string
      host?: string
      port?: string | number
      database?: string
    }
    revealPassword?: boolean
  }
) => {
  const isMd5 = connString.includes('options=reference')
  
  /**
   * Formats username for connection string display, ensuring correct format for different permission levels
   * Requirement 2.5: Indicate correct username format when credentials are configured
   */
  const formatUserForDisplay = (user: string | undefined): string => {
    if (!user || user === '[user]') {
      return '[user]'
    }

    // Ensure username is properly formatted and not empty
    const trimmedUser = user.trim()
    if (trimmedUser === '') {
      return '[user]'
    }

    // Validate username format for PostgreSQL compatibility
    try {
      return validateAndFormatUsername(trimmedUser)
    } catch (error) {
      console.warn(`Invalid username format: ${trimmedUser}. Using placeholder.`)
      return '[user]'
    }
  }

  // Use actual connection info when available, otherwise fall back to placeholders
  // Requirements 2.2, 2.3, 2.4: Use actual values instead of placeholders when available
  const actualUser = formatUserForDisplay(actualConnectionInfo?.user)
  const actualPassword = revealPassword && actualConnectionInfo?.password 
    ? actualConnectionInfo.password 
    : '[password]'
  const actualHost = actualConnectionInfo?.host || (process.env.POSTGRES_HOST && process.env.POSTGRES_HOST !== 'localhost' ? process.env.POSTGRES_HOST : undefined)
  const actualPort = actualConnectionInfo?.port?.toString() || (process.env.POSTGRES_PORT && process.env.POSTGRES_PORT !== '5432' ? process.env.POSTGRES_PORT : portNumber)
  // Fix: Prioritize actual database name from connection info, avoid using project ref as database name
  const actualDatabase = actualConnectionInfo?.database || (process.env.POSTGRES_DB && process.env.POSTGRES_DB !== 'postgres' ? process.env.POSTGRES_DB : '[db-name]')
  
  const poolerHostDetails = [
    { value: cloudProvider.toLocaleLowerCase(), tooltip: 'Cloud provider' },
    { value: '-0-', tooltip: undefined },
    { value: region, tooltip: "Project's region" },
    { value: `.pooler.supabase.${tld}`, tooltip: undefined },
  ]
  
  // Use actual host if available, otherwise use the constructed host details
  const dbHostDetails = actualHost 
    ? [{ value: actualHost, tooltip: 'Database host' }]
    : [
        { value: 'db.', tooltip: undefined },
        { value: ref, tooltip: PROJECT_REF_DESC },
        { value: `.supabase.${tld}`, tooltip: undefined },
      ]

  if (selectedTab === 'uri' || selectedTab === 'nodejs') {
    if (isMd5) {
      return [
        { value: 'postgresql://', tooltip: undefined },
        { value: actualUser, tooltip: DB_USER_DESC },
        { value: ':', tooltip: undefined },
        { value: actualPassword, tooltip: DB_PASS_DESC },
        { value: '@', tooltip: undefined },
        ...(usePoolerConnection ? poolerHostDetails : dbHostDetails),
        { value: ':', tooltip: undefined },
        { value: actualPort, tooltip: PORT_NUMBER_DESC },
        { value: '/', tooltip: undefined },
        { value: actualDatabase, tooltip: DB_NAME_DESC },
        ...(usePoolerConnection
          ? [
              { value: `?options=reference%3D`, tooltip: undefined },
              { value: ref, tooltip: PROJECT_REF_DESC },
            ]
          : []),
      ]
    } else {
      return [
        { value: 'postgresql://', tooltip: undefined },
        { value: actualUser, tooltip: DB_USER_DESC },
        ...(usePoolerConnection
          ? [
              { value: '.', tooltip: undefined },
              { value: ref, tooltip: PROJECT_REF_DESC },
            ]
          : []),
        { value: ':', tooltip: undefined },
        { value: actualPassword, tooltip: DB_PASS_DESC },
        { value: '@', tooltip: undefined },
        ...(usePoolerConnection ? poolerHostDetails : dbHostDetails),
        { value: ':', tooltip: undefined },
        { value: actualPort, tooltip: PORT_NUMBER_DESC },
        { value: '/', tooltip: undefined },
        { value: actualDatabase, tooltip: DB_NAME_DESC },
      ]
    }
  }

  if (selectedTab === 'psql') {
    if (isMd5) {
      return [
        { value: 'psql "postgresql://', tooltip: undefined },
        { value: actualUser, tooltip: DB_USER_DESC },
        { value: ':', tooltip: undefined },
        { value: actualPassword, tooltip: DB_PASS_DESC },
        { value: '@', tooltip: undefined },
        ...(usePoolerConnection ? poolerHostDetails : dbHostDetails),
        { value: ':', tooltip: undefined },
        { value: actualPort, tooltip: PORT_NUMBER_DESC },
        { value: '/', tooltip: undefined },
        { value: actualDatabase, tooltip: DB_NAME_DESC },
        ...(usePoolerConnection
          ? [
              { value: '?options=reference%3D', tooltip: undefined },
              { value: ref, tooltip: PROJECT_REF_DESC },
            ]
          : []),
      ]
    } else {
      return [
        { value: 'psql -h ', tooltip: undefined },
        ...(usePoolerConnection ? poolerHostDetails : dbHostDetails),
        { value: ' -p ', tooltip: undefined },
        { value: actualPort, tooltip: PORT_NUMBER_DESC },
        { value: ' -d ', tooltip: undefined },
        { value: actualDatabase, tooltip: DB_NAME_DESC },
        { value: ' -U ', tooltip: undefined },
        { value: actualUser, tooltip: DB_USER_DESC },
        ...(usePoolerConnection
          ? [
              { value: '.', tooltip: undefined },
              { value: ref, tooltip: PROJECT_REF_DESC },
            ]
          : []),
      ]
    }
  }

  if (selectedTab === 'golang' || selectedTab === 'php' || selectedTab === 'python') {
    if (isMd5) {
      return [
        { value: 'user=', tooltip: undefined },
        { value: actualUser, tooltip: DB_USER_DESC },
        { value: ' password=', tooltip: undefined },
        { value: actualPassword, tooltip: DB_PASS_DESC },
        { value: ' host=', tooltip: undefined },
        ...(usePoolerConnection ? poolerHostDetails : dbHostDetails),
        { value: ' port=', tooltip: undefined },
        { value: actualPort, tooltip: PORT_NUMBER_DESC },
        { value: ' dbname=', tooltip: undefined },
        { value: actualDatabase, tooltip: DB_NAME_DESC },
        ...(usePoolerConnection
          ? [
              { value: ' options=reference=', tooltip: undefined },
              { value: ref, tooltip: PROJECT_REF_DESC },
            ]
          : []),
      ]
    } else {
      return [
        { value: 'user=', tooltip: undefined },
        { value: actualUser, tooltip: DB_USER_DESC },
        ...(usePoolerConnection
          ? [
              { value: '.', tooltip: undefined },
              { value: ref, tooltip: PROJECT_REF_DESC },
            ]
          : []),
        { value: ' password=', tooltip: undefined },
        { value: actualPassword, tooltip: DB_PASS_DESC },
        { value: ' host=', tooltip: undefined },
        ...(usePoolerConnection ? poolerHostDetails : dbHostDetails),
        { value: ' port=', tooltip: undefined },
        { value: actualPort, tooltip: PORT_NUMBER_DESC },
        { value: ' dbname=', tooltip: undefined },
        { value: actualDatabase, tooltip: DB_NAME_DESC },
      ]
    }
  }

  if (selectedTab === 'jdbc') {
    if (isMd5) {
      return [
        { value: 'jdbc:postgresql://', tooltip: undefined },
        ...(usePoolerConnection ? poolerHostDetails : dbHostDetails),
        { value: ':', tooltip: undefined },
        { value: actualPort, tooltip: PORT_NUMBER_DESC },
        { value: '/', tooltip: undefined },
        { value: actualDatabase, tooltip: DB_NAME_DESC },
        { value: '?user=', tooltip: undefined },
        { value: actualUser, tooltip: DB_USER_DESC },
        { value: '&password=', tooltip: undefined },
        { value: actualPassword, tooltip: DB_PASS_DESC },
        ...(usePoolerConnection
          ? [
              { value: '&options=reference%3D', tooltip: undefined },
              { value: ref, tooltip: PROJECT_REF_DESC },
            ]
          : []),
      ]
    } else {
      return [
        { value: 'jdbc:postgresql://', tooltip: undefined },
        ...(usePoolerConnection ? poolerHostDetails : dbHostDetails),
        { value: `:`, tooltip: undefined },
        { value: actualPort, tooltip: PORT_NUMBER_DESC },
        { value: '/', tooltip: undefined },
        { value: actualDatabase, tooltip: DB_NAME_DESC },
        { value: '?user=', tooltip: undefined },
        { value: actualUser, tooltip: DB_USER_DESC },
        ...(usePoolerConnection
          ? [
              { value: '.', tooltip: undefined },
              { value: ref, tooltip: PROJECT_REF_DESC },
            ]
          : []),
        { value: '&password=', tooltip: undefined },
        { value: actualPassword, tooltip: DB_PASS_DESC },
      ]
    }
  }

  if (selectedTab === 'dotnet') {
    if (isMd5) {
      return [
        { value: 'User Id=', tooltip: undefined },
        { value: actualUser, tooltip: DB_USER_DESC },
        { value: ';Password=', tooltip: undefined },
        { value: actualPassword, tooltip: DB_PASS_DESC },
        { value: ';Server=', tooltip: undefined },
        ...(usePoolerConnection ? poolerHostDetails : dbHostDetails),
        { value: ';Port=', tooltip: undefined },
        { value: actualPort, tooltip: PORT_NUMBER_DESC },
        { value: ';Database=', tooltip: undefined },
        { value: actualDatabase, tooltip: DB_NAME_DESC },
        ...(usePoolerConnection
          ? [
              { value: ";Options='reference=", tooltip: undefined },
              { value: ref, tooltip: PROJECT_REF_DESC },
              { value: "'", tooltip: undefined },
            ]
          : []),
      ]
    } else {
      return [
        { value: 'User Id=', tooltip: undefined },
        { value: actualUser, tooltip: DB_USER_DESC },
        ...(usePoolerConnection
          ? [
              { value: '.', tooltip: undefined },
              { value: ref, tooltip: PROJECT_REF_DESC },
            ]
          : []),
        { value: ';Password=', tooltip: undefined },
        { value: actualPassword, tooltip: DB_PASS_DESC },
        { value: ';Server=', tooltip: undefined },
        ...(usePoolerConnection ? poolerHostDetails : dbHostDetails),
        { value: ';Port=', tooltip: undefined },
        { value: actualPort, tooltip: PORT_NUMBER_DESC },
        { value: ';Database=', tooltip: undefined },
        { value: actualDatabase, tooltip: DB_NAME_DESC },
      ]
    }
  }

  return []
}

/**
 * Validates that a connection string follows the correct PostgreSQL URI format
 * Requirement 2.1: Ensure format is postgresql://[user]:[password]@[host]:[port]/[database]
 * 
 * @param connectionString - The connection string to validate
 * @returns True if the format is valid, false otherwise
 */
export const validateConnectionStringFormat = (connectionString: string): boolean => {
  // PostgreSQL URI format: postgresql://[user]:[password]@[host]:[port]/[database]
  const postgresqlUriRegex = /^postgresql:\/\/[^:]+:[^@]+@[^:]+:\d+\/[^\/]+$/
  return postgresqlUriRegex.test(connectionString)
}

/**
 * Ensures connection string parameters are properly substituted
 * Requirement 2.2, 2.3, 2.4: Use actual values instead of placeholders
 * 
 * @param connectionString - The connection string to validate
 * @returns True if no placeholders remain, false otherwise
 */
export const validateParameterSubstitution = (connectionString: string): boolean => {
  // Check for common placeholder patterns that should be replaced
  const placeholderPatterns = [
    /\[user\]/,
    /\[host\]/,
    /\[port\]/,
    /\[database\]/,
    /\[db-name\]/,
    /localhost/,  // Should be replaced with actual host in production
    /postgres$/,  // Generic database name should be replaced with actual project database
  ]
  
  return !placeholderPatterns.some(pattern => pattern.test(connectionString))
}

/**
 * Validates and formats username for connection strings
 * Ensures correct user credentials are displayed for different permission levels
 * 
 * @param username - The username to validate and format
 * @param isReadOnly - Whether this is for read-only access
 * @returns Validated and formatted username
 */
export const validateAndFormatUsername = (username: string, isReadOnly: boolean = false): string => {
  // Handle empty or invalid usernames
  if (!username || username.trim() === '') {
    throw new Error('Username cannot be empty for connection string')
  }

  const trimmedUsername = username.trim()

  // Validate username format (PostgreSQL username rules - allow letters, numbers, underscores, and hyphens)
  // PostgreSQL identifiers can contain letters, digits, underscores, and dollar signs, and can start with letters or underscores
  // For connection strings, we also allow hyphens which are common in usernames
  if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(trimmedUsername)) {
    throw new Error(`Invalid username format: ${trimmedUsername}. Username must start with a letter or underscore and contain only letters, numbers, underscores, and hyphens.`)
  }

  // For read-only connections, ensure we're using appropriate read-only credentials
  if (isReadOnly) {
    // If the username doesn't indicate read-only permissions and we have a read-only user available,
    // suggest using the proper read-only user
    if (!trimmedUsername.includes('read_only') && !trimmedUsername.includes('readonly')) {
      const readOnlyUser = process.env.POSTGRES_USER_READ_ONLY
      if (readOnlyUser && readOnlyUser.trim() !== '' && trimmedUsername !== readOnlyUser.trim()) {
        console.warn(`Using ${trimmedUsername} for read-only connection. Consider using ${readOnlyUser} for read-only access.`)
      }
    }
  }

  return trimmedUsername
}

/**
 * Gets the appropriate username for a given permission level
 * 
 * @param isReadOnly - Whether to get read-only or read-write username
 * @param customUser - Optional custom username override
 * @returns The appropriate username for the permission level
 */
export const getUsernameForPermissionLevel = (isReadOnly: boolean = false, customUser?: string): string => {
  // If custom user is provided, validate and return it
  if (customUser && customUser.trim() !== '') {
    return validateAndFormatUsername(customUser, isReadOnly)
  }

  // Get appropriate username from environment variables
  const envUser = isReadOnly 
    ? process.env.POSTGRES_USER_READ_ONLY 
    : process.env.POSTGRES_USER_READ_WRITE

  if (envUser && envUser.trim() !== '') {
    return validateAndFormatUsername(envUser, isReadOnly)
  }

  // Use default usernames as final fallback
  const defaultUser = isReadOnly ? 'supabase_read_only_user' : 'supabase_admin'
  return validateAndFormatUsername(defaultUser, isReadOnly)
}

/**
 * Validates that connection string contains auto-generated credentials
 * Requirements 2.1, 2.2, 2.3: Ensure connection strings use auto-generated values
 * 
 * @param connectionString - The connection string to validate
 * @param expectedCredentials - Expected auto-generated credentials
 * @returns True if connection string contains auto-generated credentials
 */
export const validateAutoGeneratedCredentials = (
  connectionString: string, 
  expectedCredentials: {
    user?: string
    database?: string
    host?: string
    port?: number
  }
): boolean => {
  try {
    const url = new URL(connectionString)
    
    // Check if username matches expected auto-generated format
    if (expectedCredentials.user && url.username !== expectedCredentials.user) {
      return false
    }
    
    // Check if database name matches expected auto-generated format
    if (expectedCredentials.database) {
      const dbName = url.pathname.slice(1) // Remove leading slash
      if (dbName !== expectedCredentials.database) {
        return false
      }
    }
    
    // Check if host matches expected value
    if (expectedCredentials.host && url.hostname !== expectedCredentials.host) {
      return false
    }
    
    // Check if port matches expected value
    if (expectedCredentials.port && url.port && parseInt(url.port, 10) !== expectedCredentials.port) {
      return false
    }
    
    return true
  } catch (error) {
    return false
  }
}

/**
 * Enhanced connection string generator that ensures proper parameter substitution
 * Requirements 2.1, 2.2, 2.3, 2.5: Generate properly formatted connection strings with auto-generated credentials
 * @param connectionInfo - Database connection information
 * @param options - Additional options for connection string generation
 * @returns Connection strings with proper parameter substitution and validation
 */
export const generateEnhancedConnectionStrings = ({
  connectionInfo,
  poolingInfo,
  metadata,
  useEnvironmentDefaults = true,
  revealPassword = false,
  actualPassword,
}: {
  connectionInfo: {
    db_user: string
    db_port: number
    db_host: string
    db_name: string
  }
  poolingInfo?: {
    connectionString: string
    db_user: string
    db_port: number
    db_host: string
    db_name: string
  }
  metadata: {
    projectRef?: string
    pgVersion?: string
  }
  useEnvironmentDefaults?: boolean
  revealPassword?: boolean
  actualPassword?: string
}): {
  direct: ConnectionStrings
  pooler: ConnectionStrings
  validation: {
    isValid: boolean
    errors: string[]
  }
} => {
  // Get base connection strings
  const baseStrings = getConnectionStrings({ 
    connectionInfo, 
    poolingInfo, 
    metadata, 
    revealPassword, 
    actualPassword 
  })
  
  if (!useEnvironmentDefaults) {
    return {
      ...baseStrings,
      validation: { isValid: true, errors: [] }
    }
  }
  
  // Get environment values for placeholder replacement with environment-specific adaptation
  // Use the actual database name from connectionInfo to ensure correct database name is used
  const actualDatabaseName = connectionInfo.db_name
  const envValues = getEnvironmentSpecificValues(metadata.projectRef, actualDatabaseName)
  
  // Replace placeholders in direct connection strings
  const enhancedDirect: ConnectionStrings = {
    psql: replacePlaceholders(baseStrings.direct.psql, envValues),
    uri: replacePlaceholders(baseStrings.direct.uri, envValues),
    golang: replacePlaceholders(baseStrings.direct.golang, envValues),
    jdbc: replacePlaceholders(baseStrings.direct.jdbc, envValues),
    dotnet: replacePlaceholders(baseStrings.direct.dotnet, envValues),
    nodejs: replacePlaceholders(baseStrings.direct.nodejs, envValues),
    php: replacePlaceholders(baseStrings.direct.php, envValues),
    python: replacePlaceholders(baseStrings.direct.python, envValues),
    sqlalchemy: replacePlaceholders(baseStrings.direct.sqlalchemy, envValues),
  }
  
  // Replace placeholders in pooler connection strings
  const enhancedPooler: ConnectionStrings = {
    psql: replacePlaceholders(baseStrings.pooler.psql, envValues),
    uri: replacePlaceholders(baseStrings.pooler.uri, envValues),
    golang: replacePlaceholders(baseStrings.pooler.golang, envValues),
    jdbc: replacePlaceholders(baseStrings.pooler.jdbc, envValues),
    dotnet: replacePlaceholders(baseStrings.pooler.dotnet, envValues),
    nodejs: replacePlaceholders(baseStrings.pooler.nodejs, envValues),
    php: replacePlaceholders(baseStrings.pooler.php, envValues),
    python: replacePlaceholders(baseStrings.pooler.python, envValues),
    sqlalchemy: replacePlaceholders(baseStrings.pooler.sqlalchemy, envValues),
  }
  
  // Validate the generated connection strings
  const validationErrors: string[] = []
  
  // Requirements 2.1, 2.2, 2.3: Validate PostgreSQL URI format with auto-generated credentials
  if (!validateConnectionStringFormat(enhancedDirect.uri)) {
    validationErrors.push('Direct URI connection string does not follow PostgreSQL format')
  }
  
  // Requirements 2.1, 2.2, 2.3: Validate parameter substitution with auto-generated credentials
  if (!validateParameterSubstitution(enhancedDirect.uri)) {
    validationErrors.push('Direct URI connection string contains unresolved placeholders')
  }
  
  // Requirements 2.1, 2.2, 2.3: Validate auto-generated credentials are properly included
  if (!validateAutoGeneratedCredentials(enhancedDirect.uri, {
    user: connectionInfo.db_user,
    database: connectionInfo.db_name,
    host: connectionInfo.db_host,
    port: connectionInfo.db_port
  })) {
    validationErrors.push('Direct URI connection string does not contain expected auto-generated credentials')
  }
  
  return {
    direct: enhancedDirect,
    pooler: enhancedPooler,
    validation: {
      isValid: validationErrors.length === 0,
      errors: validationErrors
    }
  }
}

/**
 * Gets environment-specific values based on current environment configuration
 * Requirement 3.3: Environment-specific adaptation
 */
function getEnvironmentSpecificValues(projectRef?: string, actualDatabaseName?: string): {
  user: string
  password: string
  host: string
  port: string
  database: string
  projectRef: string
} {
  // Detect current environment
  const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development'
  
  // Adapt values based on environment
  let host: string
  let port: string
  let user: string
  let database: string
  
  switch (environment) {
    case 'production':
      host = process.env.POSTGRES_HOST || 'localhost'
      port = process.env.POSTGRES_PORT || '5432'
      user = process.env.POSTGRES_USER_READ_WRITE || 'supabase_admin'
      // Use actual database name if provided, otherwise fall back to environment variable
      database = actualDatabaseName || process.env.POSTGRES_DB || 'postgres'
      break
      
    case 'staging':
      host = process.env.POSTGRES_HOST || 'localhost'
      port = process.env.POSTGRES_PORT || '5432'
      user = process.env.POSTGRES_USER_READ_WRITE || 'supabase_admin'
      // Use actual database name if provided, otherwise fall back to environment variable
      database = actualDatabaseName || process.env.POSTGRES_DB || 'postgres'
      break
      
    case 'development':
    default:
      host = process.env.POSTGRES_HOST || 'localhost'
      port = process.env.POSTGRES_PORT || '5432'
      user = process.env.POSTGRES_USER_READ_WRITE || 'postgres'
      database = actualDatabaseName || process.env.POSTGRES_DB || 'postgres'
      break
  }
  
  return {
    user,
    password: '[YOUR_PASSWORD]', // Keep password masked for security
    host,
    port,
    database,
    projectRef: projectRef || '',
  }
}
