package `in`.dusky.foundation

import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.DriverManager
import kotlin.test.assertEquals

@Tag("postgres")
class PostgresFoundationTest {
    @Test
    fun `postgres infrastructure accepts deterministic integration query`() {
        PostgreSQLContainer("postgres:17-alpine").use { postgres ->
            postgres.start()
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use { statement ->
                    statement.executeQuery("select 1").use { result ->
                        result.next()
                        assertEquals(1, result.getInt(1))
                    }
                }
            }
        }
    }
}
